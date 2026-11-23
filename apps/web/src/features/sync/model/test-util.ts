import type {
  Clock,
  LearnKanaKey,
  LogEvent,
  LogPage,
  PullResponse,
  Scheduler,
  SyncRequest,
  TimeoutHandle,
  ValidSettings,
} from '@nekotype/shared/types';
import {
  decodePage,
  encodePage,
  isObject,
  isLogPage,
  mergeSettings,
} from '@nekotype/shared/runtime';
import type { ChangeChannel, Db, TypedChannel } from '@/shared/lib';
import { createMemoryDb } from '@/shared/lib';
import type { LearnMessage } from '@/entities/learn';
import type { FetchLike } from '@/shared/api';
import { createSyncEngine } from './engine';
import type { SyncEngine, SyncEnv, SyncLocks } from './engine';

// Doubles for the sync engine's tests: a clock and timers moved by hand, the lock, the page, and a
// server that implements the log protocol of backend.md: one row per accepted batch.

export class TestClock implements Clock {
  constructor(public time = 1_700_000_000_000) {}
  now(): number {
    return this.time;
  }
}

/** Timers that run when the clock is advanced, in order of their time. */
export class TimerScheduler implements Scheduler {
  private nextId = 1;
  private readonly tasks = new Map<number, { at: number; fn: () => void }>();
  constructor(private readonly clock: TestClock) {}

  setTimeout(fn: () => void, ms: number): TimeoutHandle {
    const id = this.nextId++;
    this.tasks.set(id, { at: this.clock.time + ms, fn });
    return { id };
  }
  clearTimeout(handle: TimeoutHandle): void {
    if (typeof handle.id === 'number') this.tasks.delete(handle.id);
  }
  setInterval(fn: () => void, ms: number): TimeoutHandle {
    return this.setTimeout(fn, ms);
  }
  clearInterval(handle: TimeoutHandle): void {
    this.clearTimeout(handle);
  }
  /** Delays of the pending timers, ascending. */
  get pending(): number[] {
    return [...this.tasks.values()].map((t) => t.at - this.clock.time).sort((a, b) => a - b);
  }
  /** Moves the clock by `ms`, running the timers that fall due on the way. */
  advance(ms: number): void {
    const target = this.clock.time + ms;
    for (;;) {
      let next: [number, { at: number; fn: () => void }] | null = null;
      for (const entry of this.tasks) {
        if (entry[1].at <= target && (next === null || entry[1].at < next[1].at)) next = entry;
      }
      if (next === null) break;
      this.tasks.delete(next[0]);
      this.clock.time = Math.max(this.clock.time, next[1].at);
      next[1].fn();
    }
    this.clock.time = target;
  }
}

/** One lock shared by every engine that is given it, as the Web Lock is shared by the tabs. */
export function createTestLocks(): SyncLocks & { readonly held: () => boolean } {
  let tail: Promise<unknown> = Promise.resolve();
  let busy = false;
  const run = <T>(job: () => Promise<T>): Promise<T> => {
    const result = tail.then(async () => {
      busy = true;
      try {
        return await job();
      } finally {
        busy = false;
      }
    });
    tail = result.catch(() => {});
    return result;
  };
  return { run, tryRun: (job) => (busy ? Promise.resolve(null) : run(job)), held: () => busy };
}

export function createTestEnv(): SyncEnv & {
  online: boolean;
  readonly goOnline: () => void;
  readonly goOffline: () => void;
  readonly hide: () => void;
} {
  const handlers: Record<'online' | 'offline' | 'hidden', (() => void)[]> = {
    online: [],
    offline: [],
    hidden: [],
  };
  const subscribe = (list: (() => void)[], handler: () => void): (() => void) => {
    list.push(handler);
    return () => {
      list.splice(list.indexOf(handler), 1);
    };
  };
  const env = {
    online: true,
    isOnline: () => env.online,
    onOnline: (h: () => void) => subscribe(handlers.online, h),
    onOffline: (h: () => void) => subscribe(handlers.offline, h),
    onHidden: (h: () => void) => subscribe(handlers.hidden, h),
    goOnline: () => {
      env.online = true;
      for (const h of [...handlers.online]) h();
    },
    goOffline: () => {
      env.online = false;
      for (const h of [...handlers.offline]) h();
    },
    hide: () => {
      for (const h of [...handlers.hidden]) h();
    },
  };
  return env;
}

export type TestChannel = ChangeChannel & { readonly posts: string[] };

export function createTestChannel(): TestChannel {
  const posts: string[] = [];
  return {
    posts,
    post: (message = 'change') => {
      posts.push(message);
    },
    listen: () => {},
  };
}

export type TestLearnChannel = TypedChannel<LearnMessage> & { readonly posts: LearnMessage[] };

export function createTestLearnChannel(): TestLearnChannel {
  const posts: LearnMessage[] = [];
  return {
    posts,
    post: (message) => {
      posts.push(message);
    },
    listen: () => {},
  };
}

export type RecordedRequest = {
  readonly method: string;
  readonly url: string;
  readonly body: string | null;
  readonly keepalive: boolean;
};

type Forced = () => Response | Promise<Response>;

const json = (status: number, body: unknown, headers: Record<string, string> = {}): Response =>
  new Response(JSON.stringify(body), {
    status,
    headers: { 'Content-Type': 'application/json', ...headers },
  });

export const errorResponse = (
  status: number,
  code: string,
  extra: { lastSeq?: number; retryAfter?: number } = {},
): Response =>
  json(
    status,
    { error: { code, ...(extra.lastSeq === undefined ? {} : { lastSeq: extra.lastSeq }) } },
    extra.retryAfter === undefined ? {} : { 'Retry-After': String(extra.retryAfter) },
  );

const isSyncRequestLike = (value: unknown): value is SyncRequest =>
  isObject(value) &&
  typeof value['deviceId'] === 'string' &&
  typeof value['seq'] === 'number' &&
  typeof value['after'] === 'number' &&
  (value['log'] === null || isLogPage(value['log']));

/** The rows a pull page holds at most; small, so tests reach `more`. */
export const TEST_PULL_ROWS = 3;

type ServerRow = { readonly id: number; readonly deviceId: string; readonly log: LogPage };

/** The server of backend.md for one user: `seq` rules, one row per batch, pages of rows. */
export function createFakeServer() {
  let settings: ValidSettings | null = null;
  const rows: ServerRow[] = [];
  const seqs = new Map<string, number>();
  const requests: RecordedRequest[] = [];
  const forced: Forced[] = [];
  let beforeResponse: ((request: RecordedRequest) => void) | null = null;
  let lostAcks = 0;

  const moreFor = (deviceId: string, after: number): boolean =>
    rows.some((r) => r.id > after && r.deviceId !== deviceId);

  const fetchFn: FetchLike = (input, init) => {
    const request: RecordedRequest = {
      method: init.method ?? 'GET',
      url: input,
      body: typeof init.body === 'string' ? init.body : null,
      keepalive: init.keepalive === true,
    };
    requests.push(request);
    beforeResponse?.(request);
    const next = forced.shift();
    if (next !== undefined) return Promise.resolve(next());
    const url = new URL(input, 'https://nekotype.test');
    if (request.method === 'POST') {
      const sync: unknown = JSON.parse(request.body ?? 'null');
      if (!isSyncRequestLike(sync)) return Promise.resolve(errorResponse(400, 'invalid_body'));
      const last = seqs.get(sync.deviceId) ?? 0;
      if (sync.seq > last + 1)
        return Promise.resolve(errorResponse(409, 'seq_gap', { lastSeq: last }));
      if (sync.seq === last + 1) {
        if (sync.log !== null)
          rows.push({ id: rows.length + 1, deviceId: sync.deviceId, log: sync.log });
        settings = mergeSettings(settings, sync.settings, sync.seq);
        seqs.set(sync.deviceId, sync.seq);
      }
      if (lostAcks > 0) {
        // The batch is stored, the answer never arrives.
        lostAcks -= 1;
        throw new TypeError('Failed to fetch');
      }
      return Promise.resolve(
        json(200, {
          lastSeq: seqs.get(sync.deviceId) ?? 0,
          more: moreFor(sync.deviceId, sync.after),
        }),
      );
    }
    const deviceId = url.searchParams.get('deviceId') ?? '';
    const after = Number(url.searchParams.get('after'));
    const page: PullResponse['rows'][number][] = [];
    let lastId = after;
    let more = false;
    for (const row of rows) {
      if (row.id <= after) continue;
      if (page.length >= TEST_PULL_ROWS) {
        more = true;
        break;
      }
      lastId = row.id;
      if (row.deviceId !== deviceId) page.push({ id: row.id, log: row.log });
    }
    const body: PullResponse = { last: lastId, more, settings, rows: page };
    return Promise.resolve(json(200, body));
  };

  return {
    fetch: fetchFn,
    requests,
    posts: () => requests.filter((r) => r.method === 'POST'),
    gets: () => requests.filter((r) => r.method === 'GET'),
    rows: () => rows,
    /** The events the server holds, of every device, in row order. */
    events: (): LogEvent[] => rows.flatMap((r) => decodePage(r.log) ?? []),
    settings: () => settings,
    lastSeq: (deviceId: string) => seqs.get(deviceId) ?? 0,
    /** The next requests get these answers instead of the server's, in order. */
    force: (...responses: Forced[]) => {
      forced.push(...responses);
    },
    /** The next `count` batches are applied, but their answers are lost. */
    loseAcks: (count: number) => {
      lostAcks += count;
    },
    forceNetworkError: () => {
      forced.push(() => {
        throw new TypeError('Failed to fetch');
      });
    },
    /** Another device's batch, stored directly. */
    externalWrite: (deviceId: string, events: readonly LogEvent[]) => {
      rows.push({ id: rows.length + 1, deviceId, log: encodePage(events) });
    },
    onRequest: (hook: ((request: RecordedRequest) => void) | null) => {
      beforeResponse = hook;
    },
    setSettings: (next: ValidSettings | null) => {
      settings = next;
    },
    setLastSeq: (deviceId: string, seq: number) => {
      seqs.set(deviceId, seq);
    },
  };
}

export type FakeServer = ReturnType<typeof createFakeServer>;

export const KEY_A: LearnKanaKey = 'hiragana:あ';
export const KEY_I: LearnKanaKey = 'hiragana:い';

export const LOG_DEV = '0190f3a0-0000-7000-8000-00000000000a';
export const OTHER_DEV = '0190f3a0-0000-7000-8000-00000000000b';

/** `count` events of `dev`, `n` from `from`, one second apart from `at0`; answers on あ. */
export function eventsOf(dev: string, from: number, count: number, at0 = 1_000): LogEvent[] {
  return Array.from({ length: count }, (_, i) => ({
    t: 'answer' as const,
    at: at0 + (from + i) * 1000,
    dev,
    n: from + i,
    task: 'recall' as const,
    k: KEY_A,
    ok: true,
    ms: 900,
    hint: false,
    wrong: null,
    alt: null,
  }));
}

/** Stores the device's own events as the log module does: one open page and `meta/log`. */
export async function seedOwn(db: Db, count: number, from = 1, dev = LOG_DEV): Promise<LogEvent[]> {
  const events = eventsOf(dev, from, count);
  const last = events[events.length - 1];
  await db.put('log', 'own:open', encodePage(events));
  await db.put('meta', 'log', { dev, next: from + count, lastAt: last?.at ?? 0 });
  return events;
}

/** Appends `count` more own events, as the log module does: the open page and `meta/log`. */
export async function appendOwn(db: Db, count: number, dev = LOG_DEV): Promise<void> {
  const meta = await db.get('meta', 'log');
  const next = isObject(meta) && typeof meta['next'] === 'number' ? meta['next'] : 1;
  const open = decodePage(await db.get('log', 'own:open')) ?? [];
  const added = eventsOf(dev, next, count, 1_000 + next * 1000);
  const all = [...open, ...added];
  await db.put('log', 'own:open', encodePage(all));
  await db.put('meta', 'log', { dev, next: next + count, lastAt: all[all.length - 1]?.at ?? 0 });
}

export function settingsAt(updatedAt: number): ValidSettings {
  return {
    learn: { strictness: 'learner', track: 'hiragana', targetMs: 1500, sound: true },
    updatedAt,
  };
}

/** A database of a signed-in device that has not synced yet. */
export async function signedInDb(deviceId = 'dev-a', userId = 'user-1'): Promise<Db> {
  const db = createMemoryDb();
  await db.put('meta', 'userId', userId);
  await db.put('meta', 'deviceId', deviceId);
  await db.put('meta', 'lastSeq', 0);
  return db;
}

export type Rig = {
  readonly db: Db;
  readonly server: FakeServer;
  readonly clock: TestClock;
  readonly timers: TimerScheduler;
  readonly env: ReturnType<typeof createTestEnv>;
  readonly locks: ReturnType<typeof createTestLocks>;
  readonly channels: { learn: TestLearnChannel; settings: TestChannel };
  readonly refreshUser: () => Promise<void>;
  readonly refreshed: { count: number };
  /** How many times the engine asked the learn store to read the log again. */
  readonly reloads: { count: number };
  readonly engine: SyncEngine;
  /** What `requestSync` calls. */
  readonly request: () => void;
};

export async function createRig(
  options: {
    db?: Db;
    server?: FakeServer;
    clock?: TestClock;
    locks?: ReturnType<typeof createTestLocks>;
    appVersion?: string;
  } = {},
): Promise<Rig> {
  const db = options.db ?? (await signedInDb());
  const server = options.server ?? createFakeServer();
  const clock = options.clock ?? new TestClock();
  const timers = new TimerScheduler(clock);
  const env = createTestEnv();
  const locks = options.locks ?? createTestLocks();
  const channels = {
    learn: createTestLearnChannel(),
    settings: createTestChannel(),
  };
  const refreshed = { count: 0 };
  const reloads = { count: 0 };
  let handler: (() => void) | null = null;
  const refreshUser = (): Promise<void> => {
    refreshed.count += 1;
    return Promise.resolve();
  };
  const engine = createSyncEngine({
    db,
    clock,
    scheduler: timers,
    fetch: server.fetch,
    appVersion: options.appVersion ?? 'v1',
    locks,
    env,
    channels,
    reloadLearning: () => {
      reloads.count += 1;
      return Promise.resolve();
    },
    refreshUser,
    onSyncRequest: (next) => {
      handler = next;
      return () => {
        handler = null;
      };
    },
  });
  return {
    db,
    server,
    clock,
    timers,
    env,
    locks,
    channels,
    refreshUser,
    refreshed,
    reloads,
    engine,
    request: () => {
      handler?.();
    },
  };
}
