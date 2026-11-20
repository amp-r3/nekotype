import type {
  Clock,
  Counters,
  LearnDelta,
  LearnKanaKey,
  Scheduler,
  Snapshot,
  SyncRequest,
  TimeoutHandle,
  ValidSettings,
} from '@nekotype/shared/types';
import { applyBatch, emptyLearnState, isObject } from '@nekotype/shared/runtime';
import type { ChangeChannel, Db } from '@/shared/lib';
import { createMemoryDb } from '@/shared/lib';
import type { FetchLike } from '@/shared/api';
import { createSyncEngine } from './engine';
import type { SyncEngine, SyncEnv, SyncLocks } from './engine';

// Doubles for the sync engine's tests: a clock and timers moved by hand, the lock, the page, and a
// server that implements the protocol of backend.md with the shared merge functions.

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

export const emptyCounters = (): Counters => ({ started: 0, finished: 0 });

export function emptySnapshot(): Snapshot {
  return {
    settings: null,
    counters: emptyCounters(),
    learn: emptyLearnState(),
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
  isObject(value) && typeof value['deviceId'] === 'string' && typeof value['seq'] === 'number';

/** The server of backend.md for one user: `seq` rules, `version`, and the parts of the snapshot. */
export function createFakeServer() {
  let snapshot = emptySnapshot();
  let version = 0;
  const seqs = new Map<string, number>();
  const requests: RecordedRequest[] = [];
  const forced: Forced[] = [];
  let beforePart: ((part: string) => void) | null = null;
  let beforeResponse: ((request: RecordedRequest) => void) | null = null;

  const apply = (request: SyncRequest): void => {
    snapshot = applyBatch(snapshot, request);
    version += 1;
    seqs.set(request.deviceId, request.seq);
  };

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
      if (sync.seq === last + 1) apply(sync);
      return Promise.resolve(json(200, { lastSeq: seqs.get(sync.deviceId) ?? 0, version }));
    }
    const lastSeq = seqs.get(url.searchParams.get('deviceId') ?? '') ?? 0;
    const part = url.searchParams.get('part');
    if (part === null) return Promise.resolve(json(200, { lastSeq, version }));
    beforePart?.(part);
    if (part === 'recent')
      return Promise.resolve(json(200, { part, version, recent: snapshot.learn.recent }));
    if (part === 'buckets') {
      return Promise.resolve(
        json(200, { part, version, recallBuckets: snapshot.learn.recallBuckets }),
      );
    }
    const learn = {
      unlocked: snapshot.learn.unlocked,
      entries: snapshot.learn.entries,
      stats: snapshot.learn.stats,
      activeDays: snapshot.learn.activeDays,
    };
    return Promise.resolve(
      json(200, {
        part,
        lastSeq,
        version,
        settings: snapshot.settings,
        counters: snapshot.counters,
        learn,
      }),
    );
  };

  return {
    fetch: fetchFn,
    requests,
    posts: () => requests.filter((r) => r.method === 'POST'),
    gets: () => requests.filter((r) => r.method === 'GET'),
    snapshot: () => snapshot,
    version: () => version,
    lastSeq: (deviceId: string) => seqs.get(deviceId) ?? 0,
    /** The next requests get these answers instead of the server's, in order. */
    force: (...responses: Forced[]) => {
      forced.push(...responses);
    },
    forceNetworkError: () => {
      forced.push(() => {
        throw new TypeError('Failed to fetch');
      });
    },
    /** Another device's batch, applied directly. */
    externalWrite: (request: SyncRequest) => {
      apply(request);
    },
    onPart: (hook: ((part: string) => void) | null) => {
      beforePart = hook;
    },
    onRequest: (hook: ((request: RecordedRequest) => void) | null) => {
      beforeResponse = hook;
    },
    setSnapshot: (next: Snapshot, nextVersion: number) => {
      snapshot = next;
      version = nextVersion;
    },
    setLastSeq: (deviceId: string, seq: number) => {
      seqs.set(deviceId, seq);
    },
  };
}

export type FakeServer = ReturnType<typeof createFakeServer>;

export const KEY_A: LearnKanaKey = 'hiragana:あ';
export const KEY_I: LearnKanaKey = 'hiragana:い';

export function learnDelta(overrides: Partial<LearnDelta> = {}): LearnDelta {
  return { ...emptyLearnState(), ...overrides };
}

/** `delta/learn` as a store writes it. */
export function learnRecord(delta: LearnDelta, counters: Counters = emptyCounters()) {
  return { learn: delta, counters };
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
  readonly channels: { learn: TestChannel; settings: TestChannel };
  readonly refreshUser: () => Promise<void>;
  readonly refreshed: { count: number };
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
    learn: createTestChannel(),
    settings: createTestChannel(),
  };
  const refreshed = { count: 0 };
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
    engine,
    request: () => {
      handler?.();
    },
  };
}
