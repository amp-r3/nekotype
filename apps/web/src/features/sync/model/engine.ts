import type {
  Clock,
  Outbox,
  Scheduler,
  Snapshot,
  SyncResponse,
  TimeoutHandle,
} from '@nekotype/shared/types';
import {
  MAX_SYNC_BODY_BYTES,
  applyBatch,
  isSettings,
  isSnapshot,
  isSyncResponse,
} from '@nekotype/shared/runtime';
import type { ApiResult, FetchLike } from '@/shared/api';
import type { ChangeChannel, Db, Read, Write } from '@/shared/lib';
import { DELTA_STORE, META_STORE, OUTBOX_STORE, SNAPSHOT_STORE, SYNC_KEY } from '@/shared/lib';
import { createSyncApi } from '../api/sync';
import type { Parts, SyncApi } from '../api/sync';
import { appliesLocally, assembleSnapshot, settingsAfter } from '../lib/apply-ack';
import { bodyBytes, buildBatch, isEmptyLearnChanges, noLearnChanges } from '../lib/build-batch';
import type { Batch } from '../lib/build-batch';
import { readLearnChanges, readOutbox } from '../lib/stored';
import { setSyncOnline, setSyncStatus } from './status';
import type { SyncStatus } from './status';

const SETTINGS_STORE = 'settings';
const SETTINGS_KEY = 'current';

/** One request per device in this many ms (storage-sync.md, "Sync triggers"). */
export const REQUEST_SPACING_MS = 10_000;
/** The spacing of catch-up batches. */
export const CATCH_UP_SPACING_MS = 5_000;
/** The wait after a learning session ends before it is sent. */
export const AFTER_WORK_MS = 10_000;
/** The body of a request sent while the page is hidden: browsers cut `keepalive` bodies at 64 KB. */
export const KEEPALIVE_MAX_BYTES = 60 * 1024;
const MAX_SEQ_REWRITES = 3;
const DEFAULT_RETRY_MS = 5_000;

/** Runs a job under the Web Lock `nekotype-sync`, or under a mutex of its own tab (storage-sync.md, "Batches"). */
export type SyncLocks = {
  run: <T>(job: () => Promise<T>) => Promise<T>;
  /** Runs the job only when the lock is free; null when it is held. */
  tryRun: <T>(job: () => Promise<T>) => Promise<T | null>;
};

/** What the engine asks of the page. */
export type SyncEnv = {
  isOnline: () => boolean;
  onOnline: (handler: () => void) => () => void;
  onOffline: (handler: () => void) => () => void;
  /** `visibilitychange` to `hidden`. */
  onHidden: (handler: () => void) => () => void;
};

export type SyncEngineDeps = {
  readonly db: Db;
  readonly clock: Clock;
  readonly scheduler: Scheduler;
  readonly fetch: FetchLike;
  readonly appVersion: string;
  readonly locks: SyncLocks;
  readonly env: SyncEnv;
  /** The stores listen on these: a post makes them read the database again. */
  readonly channels: {
    readonly learn: ChangeChannel;
    readonly settings: ChangeChannel;
  };
  /** The user keys of `meta` changed (`sessionExpired`): the signals read them again. */
  readonly refreshUser: () => Promise<void>;
  /** Registers the handler of `requestSync`; returns the function that removes it. */
  readonly onSyncRequest: (handler: () => void) => () => void;
};

export interface SyncEngine {
  /** Starts triggering: at once on the application start, then on the events of the page. */
  start: () => void;
  stop: () => void;
  /**
   * Runs one cycle now, under the lock, regardless of the 10-second spacing (sign-out syncs first).
   * Nothing is sent before the end of a `Retry-After` wait.
   */
  syncNow: () => Promise<void>;
  /** Resolves when the work in progress and the status computation are done (tests). */
  idle: () => Promise<void>;
}

type Meta = {
  readonly userId: string | null;
  readonly deviceId: string | null;
  readonly snapshotVersion: number | null;
  readonly sessionExpired: boolean;
  readonly blockedAt: string | null;
};

const asString = (value: unknown): string | null => (typeof value === 'string' ? value : null);
const asCount = (value: unknown): number | null =>
  typeof value === 'number' && Number.isInteger(value) && value >= 0 ? value : null;

async function readMeta(db: Db): Promise<Meta> {
  const [userId, deviceId, snapshotVersion, expired, blockedAt] = await Promise.all([
    db.get(META_STORE, 'userId'),
    db.get(META_STORE, 'deviceId'),
    db.get(META_STORE, 'snapshotVersion'),
    db.get(META_STORE, 'sessionExpired'),
    db.get(META_STORE, 'syncBlockedAtVersion'),
  ]);
  return {
    userId: asString(userId),
    deviceId: asString(deviceId),
    snapshotVersion: asCount(snapshotVersion),
    sessionExpired: expired === true,
    blockedAt: asString(blockedAt),
  };
}

const metaPut = (key: string, value: unknown): Write => ({
  op: 'put',
  store: META_STORE,
  key,
  value,
});

type Verdict = 'sent' | 'again' | 'stop';

export function createSyncEngine(deps: SyncEngineDeps): SyncEngine {
  const { db, clock, scheduler, appVersion } = deps;
  let running = false;
  const isRunning = (): boolean => running;
  let timer: TimeoutHandle | null = null;
  let timerAt = 0;
  let wantsPull = false;
  let nextGap = REQUEST_SPACING_MS;
  let lastRequestAt = Number.NEGATIVE_INFINITY;
  let notBefore = 0;
  let networkFailed = false;
  // The last batch built left changes in `delta` because of the caps.
  let capped = false;
  let working: Promise<unknown> = Promise.resolve();
  let statusRun: Promise<void> = Promise.resolve();
  let removers: (() => void)[] = [];

  const post = (...names: readonly ('learn' | 'settings')[]): void => {
    for (const name of names) deps.channels[name].post();
  };

  // ---- status -------------------------------------------------------------------------------

  const computeStatus = async (): Promise<SyncStatus> => {
    const meta = await readMeta(db);
    if (meta.blockedAt === appVersion) return 'blocked';
    if (meta.sessionExpired) return 'expired';
    if (!deps.env.isOnline() || networkFailed) return 'offline';
    const [outbox, learn, settings, syncedAt] = await Promise.all([
      db.get(OUTBOX_STORE, SYNC_KEY),
      db.get(DELTA_STORE, 'learn'),
      db.get(SETTINGS_STORE, SETTINGS_KEY),
      db.get(META_STORE, 'settingsSyncedAt'),
    ]);
    const learnChanges = readLearnChanges(learn);
    const unsent = isSettings(settings) && settings.updatedAt > (asCount(syncedAt) ?? 0);
    const pending =
      outbox !== undefined ||
      (learnChanges !== null && !isEmptyLearnChanges(learnChanges)) ||
      unsent;
    return pending ? 'pending' : 'synced';
  };

  const refreshStatus = (): Promise<void> => {
    statusRun = statusRun
      .then(async () => {
        setSyncOnline(deps.env.isOnline() && !networkFailed);
        setSyncStatus(await computeStatus());
      })
      .catch(() => {});
    return statusRun;
  };

  // ---- writing the outcome ------------------------------------------------------------------

  /** Writes `meta` keys and tells the user signals. */
  const putMeta = async (entries: readonly (readonly [string, unknown])[]): Promise<void> => {
    await db.write(entries.map(([key, value]) => metaPut(key, value)));
    await deps.refreshUser();
  };

  /**
   * One transaction: the new snapshot and its version, the outbox cleared, the settings rule (D16).
   */
  const store = async (
    next: Snapshot,
    version: number,
    sent: Outbox | null,
    lastSeq: number | null,
  ): Promise<void> => {
    const reads: Read[] = [
      { store: SETTINGS_STORE, key: SETTINGS_KEY },
      { store: META_STORE, key: 'settingsSyncedAt' },
    ];
    const replaced = { settings: false };
    await db.update(
      reads,
      ([settings, syncedAt]) => {
        const after = settingsAfter(
          isSettings(settings) ? settings : null,
          asCount(syncedAt) ?? 0,
          sent?.request.delta.settings?.updatedAt ?? null,
          next.settings,
        );
        const writes: Write[] = [
          { op: 'put', store: SNAPSHOT_STORE, key: SYNC_KEY, value: next },
          metaPut('snapshotVersion', version),
          metaPut('settingsSyncedAt', after.syncedAt),
        ];
        if (lastSeq !== null) writes.push(metaPut('lastSeq', lastSeq));
        if (sent !== null) writes.push({ op: 'delete', store: OUTBOX_STORE, key: SYNC_KEY });
        if (after.replace !== null) {
          replaced.settings = true;
          writes.push({
            op: 'put',
            store: SETTINGS_STORE,
            key: SETTINGS_KEY,
            value: after.replace,
          });
        }
        return writes;
      },
      [SNAPSHOT_STORE, OUTBOX_STORE],
    );
    post('learn');
    if (replaced.settings) post('settings');
  };

  // ---- an acknowledgement -------------------------------------------------------------------

  const acknowledge = async (
    api: SyncApi,
    outbox: Outbox,
    response: SyncResponse,
  ): Promise<boolean> => {
    const [stored, version] = await Promise.all([
      db.get(SNAPSHOT_STORE, SYNC_KEY),
      db.get(META_STORE, 'snapshotVersion'),
    ]);
    const snapshot = isSnapshot(stored) ? stored : null;
    const base = appliesLocally(snapshot, asCount(version), response.version) ? snapshot : null;
    if (base !== null) {
      await store(applyBatch(base, outbox.request), response.version, outbox, response.lastSeq);
      return true;
    }
    const parts = await api.readParts();
    if (parts === null) return false;
    await store(
      assembleSnapshot(parts.rest, parts.recent, parts.buckets),
      parts.rest.version,
      outbox,
      response.lastSeq,
    );
    return true;
  };

  /** `start` and `online` with nothing to send: read the snapshot when another device wrote. */
  const pull = async (api: SyncApi): Promise<void> => {
    lastRequestAt = clock.now();
    const result = await api.check();
    if (result.kind !== 'ok') {
      await failed(result, null);
      return;
    }
    networkFailed = false;
    if (!isSyncResponse(result.body)) return;
    const [stored, version] = await Promise.all([
      db.get(SNAPSHOT_STORE, SYNC_KEY),
      db.get(META_STORE, 'snapshotVersion'),
    ]);
    if (isSnapshot(stored) && asCount(version) === result.body.version) return;
    const parts: Parts | null = await api.readParts();
    if (parts === null) return;
    await store(
      assembleSnapshot(parts.rest, parts.recent, parts.buckets),
      parts.rest.version,
      null,
      null,
    );
  };

  // ---- failed requests (storage-sync.md, "Failed requests") ---------------------------------

  const rewriteSeq = async (lastSeq: number): Promise<void> => {
    await db.update(
      [{ store: OUTBOX_STORE, key: SYNC_KEY }],
      ([value]) => {
        const outbox = readOutbox(value);
        if (outbox === null) return [];
        const seq = lastSeq + 1;
        const next: Outbox = { ...outbox, seq, request: { ...outbox.request, seq } };
        return [
          { op: 'put', store: OUTBOX_STORE, key: SYNC_KEY, value: next },
          metaPut('lastSeq', lastSeq),
        ];
      },
      [META_STORE],
    );
  };

  const failed = async (result: ApiResult, outbox: Outbox | null): Promise<Verdict> => {
    if (result.kind === 'network') {
      networkFailed = true;
      return 'stop';
    }
    if (result.kind === 'ok') return 'stop';
    networkFailed = false;
    if (result.status === 401) {
      await putMeta([['sessionExpired', true]]);
      return 'stop';
    }
    if (result.status === 409 && outbox !== null && result.lastSeq !== null) {
      await rewriteSeq(result.lastSeq);
      return 'again';
    }
    if (result.status === 400 || result.status === 413) {
      await putMeta([['syncBlockedAtVersion', appVersion]]);
      return 'stop';
    }
    if (result.status === 429 || result.retryAfterMs !== null) {
      const wait = result.retryAfterMs ?? DEFAULT_RETRY_MS;
      notBefore = clock.now() + wait;
      schedule(false, wait);
    }
    return 'stop';
  };

  // ---- building and sending a batch ---------------------------------------------------------

  /** Moves the next batch from `delta` into the outbox in one transaction (step 3). */
  const buildNext = async (deviceId: string, maxBytes: number): Promise<Outbox | null> => {
    const built: { batch: Batch | null } = { batch: null };
    await db.update(
      [
        { store: OUTBOX_STORE, key: SYNC_KEY },
        { store: DELTA_STORE, key: 'learn' },
        { store: SETTINGS_STORE, key: SETTINGS_KEY },
        { store: META_STORE, key: 'lastSeq' },
        { store: META_STORE, key: 'settingsSyncedAt' },
      ],
      ([outbox, learn, settings, lastSeq, syncedAt]) => {
        if (outbox !== undefined) return [];
        const batch = buildBatch(
          {
            deviceId,
            seq: (asCount(lastSeq) ?? 0) + 1,
            learn: readLearnChanges(learn) ?? noLearnChanges(),
            settings:
              isSettings(settings) && settings.updatedAt > (asCount(syncedAt) ?? 0)
                ? settings
                : null,
          },
          maxBytes,
        );
        if (batch === null) return [];
        built.batch = batch;
        capped = !isEmptyLearnChanges(batch.rest);
        const sent: Outbox = { seq: batch.request.seq, request: batch.request };
        return [
          { op: 'put', store: OUTBOX_STORE, key: SYNC_KEY, value: sent },
          isEmptyLearnChanges(batch.rest)
            ? { op: 'delete', store: DELTA_STORE, key: 'learn' }
            : { op: 'put', store: DELTA_STORE, key: 'learn', value: batch.rest },
        ];
      },
    );
    const batch = built.batch;
    return batch === null ? null : { seq: batch.request.seq, request: batch.request };
  };

  /** Sends the outbox once and settles the answer. */
  const send = async (api: SyncApi, outbox: Outbox, keepalive: boolean): Promise<Verdict> => {
    lastRequestAt = clock.now();
    const result = await api.post(JSON.stringify(outbox.request), keepalive);
    if (result.kind === 'ok') {
      networkFailed = false;
      if (!isSyncResponse(result.body)) return 'stop';
      return (await acknowledge(api, outbox, result.body)) ? 'sent' : 'stop';
    }
    return failed(result, outbox);
  };

  /** True when the last batch left changes out because of the caps: a catch-up batch follows (step 5). */
  const hasMore = (): boolean => capped;

  // ---- a cycle ------------------------------------------------------------------------------

  /** The user and device of a cycle, or null when syncing must not run (and the status says why). */
  const ready = async (): Promise<{ deviceId: string } | null> => {
    const meta = await readMeta(db);
    if (meta.userId === null || meta.deviceId === null || meta.sessionExpired) return null;
    if (meta.blockedAt !== null) {
      if (meta.blockedAt === appVersion) return null;
      // A new release may accept the batch (A28).
      await db.delete(META_STORE, 'syncBlockedAtVersion');
    }
    return { deviceId: meta.deviceId };
  };

  const cycle = async (withPull: boolean): Promise<void> => {
    const user = await ready();
    if (user === null || !isRunning()) return;
    const api = createSyncApi(user.deviceId, deps.fetch);
    for (let rewrites = 0; isRunning(); rewrites += 1) {
      const stored = await db.get(OUTBOX_STORE, SYNC_KEY);
      let outbox = stored === undefined ? null : readOutbox(stored);
      if (stored !== undefined && outbox === null) return;
      outbox ??= await buildNext(user.deviceId, MAX_SYNC_BODY_BYTES);
      if (outbox === null) {
        if (withPull) await pull(api);
        return;
      }
      const verdict = await send(api, outbox, false);
      if (verdict === 'again' && rewrites < MAX_SEQ_REWRITES) continue;
      if (verdict === 'sent') {
        if (hasMore()) schedule(false, CATCH_UP_SPACING_MS, CATCH_UP_SPACING_MS);
      }
      return;
    }
  };

  /** The `hidden` trigger: a request that may outlive the page, within 60 KB, only when the lock is free. */
  const hiddenCycle = async (): Promise<void> => {
    const user = await ready();
    if (user === null || !running || clock.now() < notBefore) return;
    const api = createSyncApi(user.deviceId, deps.fetch);
    const stored = await db.get(OUTBOX_STORE, SYNC_KEY);
    let outbox = stored === undefined ? null : readOutbox(stored);
    if (stored !== undefined && outbox === null) return;
    if (outbox !== null) {
      if (bodyBytes(JSON.stringify(outbox.request)) > KEEPALIVE_MAX_BYTES) return;
    } else {
      outbox = await buildNext(user.deviceId, KEEPALIVE_MAX_BYTES);
      if (outbox === null) return;
    }
    await send(api, outbox, true);
    await refreshStatus();
  };

  // ---- triggers -----------------------------------------------------------------------------

  const run = (): Promise<void> => {
    timer = null;
    const withPull = wantsPull;
    wantsPull = false;
    const gap = nextGap;
    nextGap = REQUEST_SPACING_MS;
    const wait = Math.max(lastRequestAt + gap - clock.now(), notBefore - clock.now());
    if (wait > 0) {
      schedule(withPull, wait, gap);
      return Promise.resolve();
    }
    working = deps.locks
      .run(() => cycle(withPull))
      .catch(() => {})
      .then(refreshStatus);
    return working.then(() => {});
  };

  function schedule(withPull: boolean, delay: number, gap: number = REQUEST_SPACING_MS): void {
    if (!running) return;
    wantsPull ||= withPull;
    nextGap = Math.min(nextGap, gap);
    const at = clock.now() + delay;
    if (timer !== null) {
      if (timerAt <= at) return;
      scheduler.clearTimeout(timer);
    }
    timerAt = at;
    timer = scheduler.setTimeout(() => {
      void run();
    }, delay);
  }

  return {
    start() {
      if (running) return;
      running = true;
      removers = [
        deps.onSyncRequest(() => {
          schedule(false, AFTER_WORK_MS);
          void refreshStatus();
        }),
        deps.env.onOnline(() => {
          networkFailed = false;
          schedule(true, 0);
        }),
        deps.env.onOffline(() => {
          void refreshStatus();
        }),
        deps.env.onHidden(() => {
          void deps.locks
            .tryRun(hiddenCycle)
            .catch(() => {})
            .then(refreshStatus);
        }),
      ];
      schedule(true, 0);
    },

    stop() {
      running = false;
      if (timer !== null) scheduler.clearTimeout(timer);
      timer = null;
      wantsPull = false;
      for (const remove of removers) remove();
      removers = [];
    },

    async syncNow() {
      if (!running || clock.now() < notBefore) return;
      working = deps.locks
        .run(() => cycle(false))
        .catch(() => {})
        .then(refreshStatus);
      await working;
    },

    async idle() {
      await working;
      await statusRun;
    },
  };
}
