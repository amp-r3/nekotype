import { describe, it, expect, vi } from 'vitest';
import type { Mock } from 'vitest';
import { encodePage } from '@nekotype/shared/runtime';
import type { LearnKanaKey, LogEvent } from '@nekotype/shared/types';
import { createMemoryDb } from '@/shared/lib';
import type { Db, TypedChannel } from '@/shared/lib';
import { createLearnStore } from './learn-store';
import type { LearnStore, LearnStoreDeps } from './learn-store';
import { appendEvents, isLogMeta, rowPageKey, readLog } from './log';
import type { LearnMessage } from './log';
import { ManualScheduler, TestClock } from './test-util';

const OTHER = '018f0000-0000-7000-8000-000000000002';
const A = 'hiragana:あ';
const I = 'hiragana:い';

let ids = 0;
const newId = (): string => `018f0000-0000-7000-8000-${String(100 + ids++).padStart(12, '0')}`;

type FakeChannel = TypedChannel<LearnMessage> & {
  readonly post: Mock<(message: LearnMessage) => void>;
  receive: (message: LearnMessage) => void;
};

function fakeChannel(): FakeChannel {
  let handler: (message: LearnMessage) => void = () => {};
  return {
    post: vi.fn<(message: LearnMessage) => void>(),
    listen: (onMessage) => {
      handler = onMessage;
    },
    receive: (message) => {
      handler(message);
    },
  };
}

function setup(
  options: {
    db?: Db;
    loadModel?: LearnStoreDeps['loadModel'];
    loadInsights?: LearnStoreDeps['loadInsights'];
  } = {},
) {
  const db = options.db ?? createMemoryDb();
  const clock = new TestClock();
  const scheduler = new ManualScheduler();
  const channel = fakeChannel();
  const onWriteFailed = vi.fn();
  const store = createLearnStore({
    db: () => Promise.resolve(db),
    clock,
    scheduler,
    loadModel: options.loadModel ?? (() => import('@nekotype/model')),
    loadInsights: options.loadInsights ?? (() => import('./insights')),
    newId,
    tz: () => 60,
    channel,
    onWriteFailed,
  });
  return { db, clock, scheduler, store, channel, onWriteFailed };
}

async function ready(options: Parameters<typeof setup>[0] = {}) {
  const env = setup(options);
  await env.store.init();
  return env;
}

const recall = (store: LearnStore, key: LearnKanaKey, ms = 800, ok = true): void => {
  store.recordAnswer({
    task: 'recall',
    key,
    ok,
    keystrokes: [{ t: ms, accepted: true }],
    hint: false,
    wrong: null,
    alt: null,
  });
};

/** Runs the deferred write and waits for it. */
async function settle(env: { scheduler: ManualScheduler; store: LearnStore }): Promise<void> {
  env.scheduler.runAll();
  await env.store.flush();
}

describe('the clock', () => {
  it('has a fraction, and the stored event times are integers (D2)', async () => {
    const env = await ready();
    env.clock.time = 1_700_000_000_000.4;
    env.store.startSession();
    env.clock.time += 1000.7;
    env.store.introduce(A);
    await settle(env);
    const events = await readLog(env.db);
    expect(events.map((e) => e.at)).toEqual([1_700_000_000_000, 1_700_000_001_001]);
    // They read back: a page with a fractional time would fail its check.
    expect(events).toHaveLength(2);
  });
});

describe('loading', () => {
  it('is ready only after the log and the model chunk are both read', async () => {
    let release: () => void = () => {};
    const gate = new Promise<void>((resolve) => {
      release = resolve;
    });
    const env = setup({
      loadModel: async () => {
        await gate;
        return import('@nekotype/model');
      },
    });
    const loading = env.store.init();
    await Promise.resolve();
    await new Promise((resolve) => setTimeout(resolve, 5));
    expect(env.store.status.value).toBe('loading');
    expect(env.store.view.value).toBeNull();
    expect(env.store.modelState()).toBeNull();
    release();
    await loading;
    expect(env.store.status.value).toBe('ready');
    expect(env.store.view.value?.kana.get(A)?.state).toBe('locked');
    expect(env.store.modelState()).not.toBeNull();
  });

  it('a reload during loading reads the log again when the load ends', async () => {
    let release: () => void = () => {};
    const gate = new Promise<void>((resolve) => {
      release = resolve;
    });
    const env = setup({
      loadModel: async () => {
        await gate;
        return import('@nekotype/model');
      },
    });
    const loading = env.store.init();
    await new Promise((resolve) => setTimeout(resolve, 5));
    // The log was read before the pull stored its row; the model chunk is still loading.
    const row: LogEvent = { t: 'intro', at: 1000, dev: OTHER, n: 1, k: A };
    await env.db.put('log', rowPageKey(1), encodePage([row]));
    const reloading = env.store.reload();
    release();
    await loading;
    await reloading;
    expect(env.store.view.value?.kana.get(A)?.state).toBe('learning');
  });

  it('is an error, and writes nothing, when the log cannot be read', async () => {
    const db = createMemoryDb();
    const env = setup({ db: { ...db, getAll: () => Promise.reject(new Error('closed')) } });
    await env.store.init();
    expect(env.store.status.value).toBe('error');
    env.store.introduce(A);
    expect(env.store.view.value).toBeNull();
    expect(await readLog(db)).toEqual([]);
  });

  it('reads the stored log into the view', async () => {
    const db = createMemoryDb();
    await appendEvents(db, [{ t: 'intro', at: 1000, k: A }], newId);
    const { store } = await ready({ db });
    expect(store.view.value?.kana.get(A)?.state).toBe('learning');
  });
});

describe('actions', () => {
  it('apply at once and write once, after the key handler', async () => {
    const env = await ready();
    env.store.startSession();
    env.store.introduce(A);
    recall(env.store, A);
    recall(env.store, A);
    expect(env.store.view.value?.kana.get(A)?.recall).toHaveLength(2);
    expect(env.scheduler.pending).toBe(1);
    expect(await readLog(env.db)).toEqual([]);

    await settle(env);
    const stored = await readLog(env.db);
    expect(stored.map((e) => e.t)).toEqual(['start', 'intro', 'answer', 'answer']);
    expect(stored[0]).toMatchObject({ tz: 60 });
    expect(env.channel.post).toHaveBeenCalledTimes(1);
    expect(env.channel.post.mock.calls[0]?.[0]).toMatchObject({ kind: 'append' });
  });

  it('time a recall with K and cap the other tasks', async () => {
    const env = await ready();
    env.store.introduce(A);
    recall(env.store, A, 1234);
    env.store.recordAnswer({
      task: 'recognition',
      key: A,
      ok: false,
      ms: 99_999,
      hint: false,
      wrong: I,
      alt: null,
    });
    await settle(env);
    const answers = (await readLog(env.db)).flatMap((e) => (e.t === 'answer' ? [e] : []));
    expect(answers.map((e) => e.ms)).toEqual([1234, 10_000]);
    expect(answers[1]).toMatchObject({ task: 'recognition', ok: false, wrong: I });
  });

  it('never write a keystroke', async () => {
    const env = await ready();
    env.store.introduce(A);
    recall(env.store, A);
    await settle(env);
    expect(JSON.stringify(await env.db.getAll('log'))).not.toContain('accepted');
  });
});

describe('folding again', () => {
  it('folds the log again when an event arrives out of order', async () => {
    const env = await ready();
    env.clock.time = 1_700_000_100_000;
    env.store.introduce(A);
    const earlier: LogEvent = {
      t: 'intro',
      at: 1_700_000_000_000,
      dev: OTHER,
      n: 1,
      k: I,
    };
    env.channel.receive({ kind: 'append', page: encodePage([earlier]) });
    const view = env.store.view.value;
    expect(view?.kana.get(I)?.state).toBe('learning');
    expect(view?.kana.get(A)?.state).toBe('learning');
    // The planner's state holds both
    expect(env.store.modelState()?.items.has(I)).toBe(true);
    expect(env.store.modelState()?.items.has(A)).toBe(true);
  });

  it('reads the log again when the store of another tab took the same n', async () => {
    const env = await ready();
    env.store.introduce(A);
    // Another tab of this device appends first: it takes n = 1
    await appendEvents(env.db, [{ t: 'intro', at: env.clock.now(), k: I }], newId);
    await settle(env);
    const stored = await readLog(env.db);
    expect(stored.map((e) => e.n)).toEqual([1, 2]);
    const view = env.store.view.value;
    expect(view?.kana.get(A)?.state).toBe('learning');
    expect(view?.kana.get(I)?.state).toBe('learning');
  });
});

describe('other tabs', () => {
  it('applies an appended page and moves the next n past the tab’s own', async () => {
    const env = await ready();
    env.store.introduce(A);
    await settle(env);
    // Another tab of this device stores its event, then tells this one
    const [next] = await appendEvents(
      env.db,
      [{ t: 'intro', at: env.clock.now() + 5, k: I }],
      newId,
    );
    expect(next?.n).toBe(2);
    env.channel.receive({ kind: 'append', page: encodePage(next === undefined ? [] : [next]) });
    expect(env.store.view.value?.kana.get(I)?.state).toBe('learning');
    env.store.introduce('hiragana:う');
    await settle(env);
    const stored = await readLog(env.db);
    expect(stored.map((e) => e.n)).toEqual([1, 2, 3]);
    // the third event was stored as this tab applied it: nothing was read again
    expect(env.store.view.value?.kana.get('hiragana:う')?.state).toBe('learning');
  });

  it('reads again on a pull message', async () => {
    const env = await ready();
    const foreign: LogEvent = { t: 'intro', at: 1000, dev: OTHER, n: 1, k: I };
    await env.db.put('log', rowPageKey(1), encodePage([foreign]));
    env.channel.receive({ kind: 'pull' });
    await env.store.flush();
    await env.store.reload();
    expect(env.store.view.value?.kana.get(I)?.state).toBe('learning');
  });

  it('empties on a reset message', async () => {
    const env = await ready();
    env.store.introduce(A);
    env.channel.receive({ kind: 'reset' });
    expect(env.store.view.value?.kana.get(A)?.state).toBe('locked');
    expect(env.store.modelState()?.items.size).toBe(0);
  });
});

describe('reset', () => {
  it('empties the view and the stored log and tells the other tabs', async () => {
    const env = await ready();
    env.store.introduce(A);
    await settle(env);
    await env.store.reset();
    expect(env.store.view.value?.kana.get(A)?.state).toBe('locked');
    expect(await readLog(env.db)).toEqual([]);
    expect(env.channel.post).toHaveBeenLastCalledWith({ kind: 'reset' });
    // a new log is a new device
    const before = await env.db.get('meta', 'log');
    expect(isLogMeta(before)).toBe(true);
    env.store.introduce(A);
    await settle(env);
    const [event] = await readLog(env.db);
    expect(event?.n).toBe(1);
    expect(event?.dev).toBe(isLogMeta(before) ? before.dev : '');
  });

  it('drops what was not written yet', async () => {
    const env = await ready();
    env.store.introduce(A);
    await env.store.reset();
    env.scheduler.runAll();
    await env.store.flush();
    expect(await readLog(env.db)).toEqual([]);
  });
});

describe('failed writes', () => {
  it('keep the events for the next write and report', async () => {
    const db = createMemoryDb();
    let failing = false;
    const flaky: Db = {
      ...db,
      update: (reads, compute, scope) =>
        failing ? Promise.reject(new Error('quota')) : db.update(reads, compute, scope),
    };
    const env = await ready({ db: flaky });
    failing = true;
    env.store.introduce(A);
    await settle(env);
    expect(env.onWriteFailed).toHaveBeenCalledTimes(1);
    expect(await readLog(db)).toEqual([]);
    expect(env.store.view.value?.kana.get(A)?.state).toBe('learning');

    failing = false;
    env.store.introduce(I);
    await settle(env);
    const stored = await readLog(db);
    expect(stored.map((e) => e.t === 'intro' && e.k)).toEqual([A, I]);
    expect(env.onWriteFailed).toHaveBeenCalledTimes(1);
  });
});

describe('startSnapshot (P8 D3)', () => {
  const stateOf = (env: Awaited<ReturnType<typeof ready>>): readonly LearnKanaKey[] => [
    ...(env.store.startSnapshot()?.state.items.keys() ?? []),
  ];

  it('is null while the log has no start', async () => {
    const env = await ready();
    expect(env.store.startSnapshot()).toBeNull();
    env.store.introduce(A);
    expect(env.store.startSnapshot()).toBeNull();
  });

  it('is the state just before the start the store applies', async () => {
    const env = await ready();
    env.store.startSession();
    expect(stateOf(env)).toEqual([]);
    env.store.introduce(A);
    recall(env.store, A);
    env.store.endSession();
    // The snapshot does not move until the next start.
    expect(stateOf(env)).toEqual([]);
    env.clock.advance(60_000);
    env.store.startSession();
    expect(stateOf(env)).toEqual([A]);
    expect(env.store.startSnapshot()?.stats?.started).toBe(1);
  });

  it('is rebuilt by a full fold: the load, a pull and a log out of order', async () => {
    const first = await ready();
    first.store.startSession();
    first.store.introduce(A);
    first.store.endSession();
    first.clock.advance(60_000);
    first.store.startSession();
    first.store.introduce(I);
    await settle(first);

    // Another tab of the device loads the same log: the snapshot is before its last start.
    const loaded = setup({ db: first.db });
    await loaded.store.init();
    expect(stateOf(loaded)).toEqual([A]);

    // A pulled row of another device that sorts before the last start moves it.
    const row: LogEvent = { t: 'start', at: 1000, dev: OTHER, n: 1, tz: 0 };
    const intro: LogEvent = { t: 'intro', at: 1001, dev: OTHER, n: 2, k: 'hiragana:う' };
    await first.db.put('log', rowPageKey(1), encodePage([row, intro]));
    await first.store.reload();
    expect(stateOf(first)).toEqual(['hiragana:う', A]);

    // The log emptied: no start.
    await first.store.reset();
    expect(first.store.startSnapshot()).toBeNull();
  });

  it('equals the plain fold: the split changes nothing', async () => {
    const env = await ready();
    env.store.startSession();
    env.store.introduce(A);
    recall(env.store, A);
    env.store.endSession();
    env.clock.advance(60_000);
    env.store.startSession();
    recall(env.store, A);
    await settle(env);
    const events = await readLog(env.db);
    const { foldLog, describe: describeView } = await import('@nekotype/model');
    const snapshot = foldLog(events, { stats: true }).snapshot();
    const split = setup({ db: env.db });
    await split.store.init();
    expect(snapshot.stats).not.toBeNull();
    if (snapshot.stats !== null) {
      expect(split.store.view.value).toEqual(describeView(snapshot.state, snapshot.stats));
    }
  });
});

describe('what the insights hook into', () => {
  it('version grows by one at each publish', async () => {
    const env = await ready();
    const v = env.store.version.value;
    env.store.introduce(A);
    expect(env.store.version.value).toBe(v + 1);
    env.store.startSession();
    expect(env.store.version.value).toBe(v + 2);
  });

  it('tells the session start and the reset, and the listener can leave', async () => {
    const env = await ready();
    const started = vi.fn();
    const reset = vi.fn();
    const leave = env.store.onSessionStart(started);
    env.store.onReset(reset);
    env.store.startSession();
    expect(started).toHaveBeenCalledTimes(1);
    env.channel.receive({ kind: 'reset' });
    expect(reset).toHaveBeenCalledTimes(1);
    await env.store.reset();
    expect(reset).toHaveBeenCalledTimes(2);
    leave();
    env.store.startSession();
    expect(started).toHaveBeenCalledTimes(1);
  });

  it('holds the model and the insights module once ready; a failed insights load is no error', async () => {
    const env = setup({});
    expect(env.store.loadedModel()).toBeNull();
    expect(env.store.loadedInsights()).toBeNull();
    await env.store.init();
    expect(env.store.loadedModel()).not.toBeNull();
    expect(env.store.loadedInsights()?.computeStepOne).toBeTypeOf('function');

    const failing = setup({ loadInsights: () => Promise.reject(new Error('offline')) });
    await failing.store.init();
    expect(failing.store.status.value).toBe('ready');
    expect(failing.store.loadedInsights()).toBeNull();
  });
});
