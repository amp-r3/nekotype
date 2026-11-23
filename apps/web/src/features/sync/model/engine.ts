import type { Clock, PullResponse, Scheduler, TimeoutHandle } from '@nekotype/shared/types';
import {
  MAX_SYNC_BODY_BYTES,
  isPullResponse,
  isSettings,
  isSyncResponse,
} from '@nekotype/shared/runtime';
import type { ApiResult, FetchLike } from '@/shared/api';
import type { ChangeChannel, Db, TypedChannel, Write } from '@/shared/lib';
import { LOG_STORE, META_STORE, OUTBOX_STORE, SYNC_KEY } from '@/shared/lib';
import {
  LOG_META_KEY,
  PULLED_ID_KEY,
  SENT_N_KEY,
  isLogMeta,
  readUnsent,
  rowPageKey,
} from '@/entities/learn';
import type { LearnMessage } from '@/entities/learn';
import { createSyncApi } from '../api/sync';
import type { SyncApi } from '../api/sync';
import { bodyBytes, buildBatch } from '../lib/build-batch';
import type { Batch } from '../lib/build-batch';
import { settingsAfter } from '../lib/settings-after';
import { lastNOf, readOutbox } from '../lib/stored';
import type { PendingBatch } from '../lib/stored';
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
    readonly learn: TypedChannel<LearnMessage>;
    readonly settings: ChangeChannel;
  };
  /** Reads the log again and folds it: called after a pull wrote rows (D17). */
  readonly reloadLearning: () => Promise<void>;
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
  readonly sessionExpired: boolean;
  readonly blockedAt: string | null;
};

const asString = (value: unknown): string | null => (typeof value === 'string' ? value : null);
const asCount = (value: unknown): number | null =>
  typeof value === 'number' && Number.isInteger(value) && value >= 0 ? value : null;
// A settings `updatedAt` comes from the clock and has a fraction; `asCount` would read it as absent.
const asTimestamp = (value: unknown): number | null =>
  typeof value === 'number' && Number.isFinite(value) && value >= 0 ? value : null;

async function readMeta(db: Db): Promise<Meta> {
  const [userId, deviceId, expired, blockedAt] = await Promise.all([
    db.get(META_STORE, 'userId'),
    db.get(META_STORE, 'deviceId'),
    db.get(META_STORE, 'sessionExpired'),
    db.get(META_STORE, 'syncBlockedAtVersion'),
  ]);
  return {
    userId: asString(userId),
    deviceId: asString(deviceId),
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
  let working: Promise<unknown> = Promise.resolve();
  let statusRun: Promise<void> = Promise.resolve();
  let removers: (() => void)[] = [];

  const postSettings = (): void => {
    deps.channels.settings.post();
  };

  // ---- status -------------------------------------------------------------------------------

  /** True when own events are not acknowledged yet: `LogMeta.next - 1 > sentN`. */
  const hasUnsentEvents = async (): Promise<boolean> => {
    const [logMeta, sentN] = await Promise.all([
      db.get(META_STORE, LOG_META_KEY),
      db.get(META_STORE, SENT_N_KEY),
    ]);
    return isLogMeta(logMeta) && logMeta.next - 1 > (asCount(sentN) ?? 0);
  };

  const computeStatus = async (): Promise<SyncStatus> => {
    const meta = await readMeta(db);
    if (meta.blockedAt === appVersion) return 'blocked';
    if (meta.sessionExpired) return 'expired';
    if (!deps.env.isOnline() || networkFailed) return 'offline';
    const [outbox, settings, syncedAt, unsentEvents] = await Promise.all([
      db.get(OUTBOX_STORE, SYNC_KEY),
      db.get(SETTINGS_STORE, SETTINGS_KEY),
      db.get(META_STORE, 'settingsSyncedAt'),
      hasUnsentEvents(),
    ]);
    const unsent = isSettings(settings) && settings.updatedAt > (asTimestamp(syncedAt) ?? 0);
    return outbox !== undefined || unsentEvents || unsent ? 'pending' : 'synced';
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
   * The settings rule (storage-sync.md, "Settings travel") as writes, for an acknowledgement and a
   * pulled page: `sentAt` is the `updatedAt` of the settings the batch carried.
   */
  const settingsWrites = (
    local: unknown,
    syncedAt: unknown,
    sentAt: number | null,
    server: PullResponse['settings'],
    flag: { settings: boolean },
  ): Write[] => {
    const after = settingsAfter(
      isSettings(local) ? local : null,
      asTimestamp(syncedAt) ?? 0,
      sentAt,
      server,
    );
    const writes: Write[] = [metaPut('settingsSyncedAt', after.syncedAt)];
    if (after.replace !== null) {
      flag.settings = true;
      writes.push({ op: 'put', store: SETTINGS_STORE, key: SETTINGS_KEY, value: after.replace });
    }
    return writes;
  };

  // ---- an acknowledgement -------------------------------------------------------------------

  /**
   * One transaction: the outbox cleared, `lastSeq`, `sentN` and the settings rule. The response
   * carries no settings, so a local document that has not changed since the batch stays as it is.
   */
  const acknowledge = async (sent: PendingBatch, lastSeq: number): Promise<void> => {
    const lastN = lastNOf(sent.request);
    const flag = { settings: false };
    await db.update(
      [
        { store: SETTINGS_STORE, key: SETTINGS_KEY },
        { store: META_STORE, key: 'settingsSyncedAt' },
        { store: META_STORE, key: SENT_N_KEY },
      ],
      ([settings, syncedAt, sentN]) => {
        const writes = settingsWrites(
          settings,
          syncedAt,
          sent.request.settings?.updatedAt ?? null,
          null,
          flag,
        );
        writes.push(metaPut('lastSeq', lastSeq), {
          op: 'delete',
          store: OUTBOX_STORE,
          key: SYNC_KEY,
        });
        if (lastN !== null) writes.push(metaPut(SENT_N_KEY, Math.max(lastN, asCount(sentN) ?? 0)));
        return writes;
      },
      [OUTBOX_STORE],
    );
    if (flag.settings) postSettings();
  };

  // ---- the pull -----------------------------------------------------------------------------

  /** Stores one page of the pull in one transaction. */
  const storePage = async (page: PullResponse): Promise<void> => {
    const flag = { settings: false };
    await db.update(
      [
        { store: SETTINGS_STORE, key: SETTINGS_KEY },
        { store: META_STORE, key: 'settingsSyncedAt' },
        { store: META_STORE, key: PULLED_ID_KEY },
      ],
      ([settings, syncedAt, pulledId]) => {
        const writes = settingsWrites(settings, syncedAt, null, page.settings, flag);
        for (const row of page.rows) {
          writes.push({ op: 'put', store: LOG_STORE, key: rowPageKey(row.id), value: row.log });
        }
        writes.push(metaPut(PULLED_ID_KEY, Math.max(page.last, asCount(pulledId) ?? 0)));
        return writes;
      },
      [LOG_STORE],
    );
    if (flag.settings) postSettings();
  };

  /** Pages of `GET ?after=` until `more` is false; the log is read again when rows arrived. */
  const pull = async (api: SyncApi): Promise<void> => {
    let after = asCount(await db.get(META_STORE, PULLED_ID_KEY)) ?? 0;
    let rows = 0;
    for (;;) {
      lastRequestAt = clock.now();
      const result = await api.pull(after);
      if (result.kind !== 'ok') {
        await failed(result, null);
        break;
      }
      networkFailed = false;
      if (!isPullResponse(result.body)) {
        // A page this version cannot read: it will not read it later either (A28).
        await putMeta([['syncBlockedAtVersion', appVersion]]);
        break;
      }
      const page = result.body;
      await storePage(page);
      rows += page.rows.length;
      after = Math.max(after, page.last);
      if (!page.more || !isRunning()) break;
    }
    if (rows > 0) {
      await deps.reloadLearning();
      deps.channels.learn.post({ kind: 'pull' });
    }
  };

  // ---- failed requests (storage-sync.md, "Failed requests") ---------------------------------

  const rewriteSeq = async (lastSeq: number): Promise<void> => {
    await db.update(
      [{ store: OUTBOX_STORE, key: SYNC_KEY }],
      ([value]) => {
        const outbox = readOutbox(value);
        if (outbox === null) return [];
        const seq = lastSeq + 1;
        const next: PendingBatch = { seq, request: { ...outbox.request, seq } };
        return [
          { op: 'put', store: OUTBOX_STORE, key: SYNC_KEY, value: next },
          metaPut('lastSeq', lastSeq),
        ];
      },
      [META_STORE],
    );
  };

  const failed = async (result: ApiResult, outbox: PendingBatch | null): Promise<Verdict> => {
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

  /**
   * Moves the next batch into the outbox in one transaction (step 3): the longest prefix of the
   * unsent own events within `maxBytes`, `after` = `pulledId` and the changed settings.
   */
  const buildNext = async (deviceId: string, maxBytes: number): Promise<PendingBatch | null> => {
    const sentN = asCount(await db.get(META_STORE, SENT_N_KEY)) ?? 0;
    const unsent = await readUnsent(db, sentN);
    const built: { batch: Batch | null } = { batch: null };
    await db.update(
      [
        { store: OUTBOX_STORE, key: SYNC_KEY },
        { store: SETTINGS_STORE, key: SETTINGS_KEY },
        { store: META_STORE, key: 'lastSeq' },
        { store: META_STORE, key: 'settingsSyncedAt' },
        { store: META_STORE, key: PULLED_ID_KEY },
      ],
      ([outbox, settings, lastSeq, syncedAt, pulledId]) => {
        if (outbox !== undefined) return [];
        const batch = buildBatch(
          {
            deviceId,
            seq: (asCount(lastSeq) ?? 0) + 1,
            after: asCount(pulledId) ?? 0,
            unsent,
            firstN: sentN + 1,
            settings:
              isSettings(settings) && settings.updatedAt > (asTimestamp(syncedAt) ?? 0)
                ? settings
                : null,
          },
          maxBytes,
        );
        if (batch === null) return [];
        built.batch = batch;
        const sent: PendingBatch = { seq: batch.request.seq, request: batch.request };
        return [{ op: 'put', store: OUTBOX_STORE, key: SYNC_KEY, value: sent }];
      },
    );
    const batch = built.batch;
    return batch === null ? null : { seq: batch.request.seq, request: batch.request };
  };

  /** Sends the outbox once and settles the answer. */
  const send = async (
    api: SyncApi,
    outbox: PendingBatch,
    keepalive: boolean,
  ): Promise<{ verdict: Verdict; more: boolean }> => {
    lastRequestAt = clock.now();
    const result = await api.post(JSON.stringify(outbox.request), keepalive);
    if (result.kind === 'ok') {
      networkFailed = false;
      if (!isSyncResponse(result.body)) return { verdict: 'stop', more: false };
      await acknowledge(outbox, result.body.lastSeq);
      return { verdict: 'sent', more: result.body.more };
    }
    return { verdict: await failed(result, outbox), more: false };
  };

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
      const { verdict, more } = await send(api, outbox, false);
      if (verdict === 'again' && rewrites < MAX_SEQ_REWRITES) continue;
      if (verdict === 'sent') {
        // Events the batch left out (the caps) or that came after it was built follow (step 5).
        if (await hasUnsentEvents()) schedule(false, CATCH_UP_SPACING_MS, CATCH_UP_SPACING_MS);
        // The first batch of a sign-in leaves the account's settings in place; the pull brings them.
        if (more || (outbox.seq === 1 && outbox.request.settings !== null)) await pull(api);
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
