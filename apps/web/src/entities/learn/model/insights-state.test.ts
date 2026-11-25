import { describe, expect, it } from 'vitest';
import * as model from '@nekotype/model';
import { answer, intro, start } from '@nekotype/model/testing';
import type { LearnKanaKey, LogEvent } from '@nekotype/shared/types';
import { createMemoryDb } from '@/shared/lib';
import type { Db } from '@/shared/lib';
import * as insightsModule from './insights';
import { createInsightsState } from './insights-state';
import type { InsightsStateDeps } from './insights-state';
import type { StartSnapshot } from './learn-store';
import { ManualScheduler, TestClock } from './test-util';

const A: LearnKanaKey = 'hiragana:あ';

function folded(events: readonly LogEvent[]) {
  const fold = model.foldLog(events, { stats: true });
  const snapshot = fold.snapshot();
  if (snapshot.stats === null) throw new Error('no statistics');
  return { snapshot, view: model.describe(snapshot.state, snapshot.stats) };
}

const settle = async (): Promise<void> => {
  await new Promise((resolve) => setTimeout(resolve, 5));
};

function setup(events: readonly LogEvent[] = [], options: { db?: Db; ready?: boolean } = {}) {
  const db = options.db ?? createMemoryDb();
  const clock = new TestClock();
  const scheduler = new ManualScheduler();
  const env: {
    events: readonly LogEvent[];
    version: number;
    ready: boolean;
    startSnapshot: StartSnapshot | null;
    starts: Set<() => void>;
    resets: Set<() => void>;
  } = {
    events,
    version: 1,
    ready: options.ready ?? true,
    startSnapshot: null,
    starts: new Set<() => void>(),
    resets: new Set<() => void>(),
  };
  const deps: InsightsStateDeps = {
    view: () => (env.ready ? folded(env.events).view : null),
    version: () => env.version,
    state: () => (env.ready ? folded(env.events).snapshot.state : null),
    startSnapshot: () => env.startSnapshot,
    model: () => (env.ready ? model : null),
    module: () => (env.ready ? insightsModule : null),
    db: () => Promise.resolve(db),
    clock,
    scheduler,
    onSessionStart: (listener) => {
      env.starts.add(listener);
      return () => env.starts.delete(listener);
    },
    onReset: (listener) => {
      env.resets.add(listener);
      return () => env.resets.delete(listener);
    },
  };
  return { db, clock, scheduler, env, state: createInsightsState(deps) };
}

describe('insights state (P8 D8)', () => {
  it('computes nothing until the scheduler runs: step 1, then step 2', async () => {
    const { state, scheduler } = setup();
    state.requestInsights('hiragana');
    expect(state.insights.value).toEqual({
      version: 1,
      track: 'hiragana',
      outline: null,
      stronger: { kind: 'pending' },
      forecast: { kind: 'pending' },
    });
    expect(scheduler.pending).toBe(1);

    scheduler.runAll();
    expect(state.insights.value?.outline).not.toBeNull();
    expect(state.insights.value?.stronger).toEqual({ kind: 'first' });
    expect(state.insights.value?.forecast).toEqual({ kind: 'pending' });
    expect(scheduler.pending).toBe(1);

    scheduler.runAll();
    await settle();
    expect(state.insights.value?.forecast.kind).toBe('ready');
    expect(scheduler.pending).toBe(0);
  });

  it('asks for the reason before any step has run: Continue does not wait', () => {
    const { state, scheduler } = setup();
    const reason = state.reasonAt(1000, 'hiragana');
    expect(reason).toEqual({ kind: 'new', key: A, row: 'hiragana:vowels' });
    expect(scheduler.pending).toBe(0);
    expect(setup([], { ready: false }).state.reasonAt(1000, 'hiragana')).toBeNull();
  });

  it('does nothing before the store is ready, and asks again when it is', () => {
    const env = setup([], { ready: false });
    env.state.requestInsights('hiragana');
    expect(env.state.insights.value).toBeNull();
    expect(env.scheduler.pending).toBe(0);
  });

  it('a second request for the same version and track neither restarts nor repeats', async () => {
    const { state, scheduler } = setup();
    state.requestInsights('hiragana');
    state.requestInsights('hiragana');
    expect(scheduler.pending).toBe(1);
    scheduler.runAll();
    scheduler.runAll();
    await settle();
    const done = state.insights.value;
    state.requestInsights('hiragana');
    expect(scheduler.pending).toBe(0);
    expect(state.insights.value).toBe(done);
  });

  it('a request for another track or a newer version replaces the pending one; the stale step does nothing', async () => {
    const { state, scheduler, env } = setup();
    state.requestInsights('hiragana');
    env.version = 2;
    state.requestInsights('katakana');
    expect(scheduler.pending).toBe(1);
    scheduler.runAll();
    expect(state.insights.value?.track).toBe('katakana');
    expect(state.insights.value?.version).toBe(2);

    // The version moves again while step 2 waits: its numbers are for a log that is gone.
    env.version = 3;
    scheduler.runAll();
    await settle();
    expect(state.insights.value?.forecast).toEqual({ kind: 'pending' });
  });

  it('a session start drops the pending steps and keeps what was published', async () => {
    const { state, scheduler, env } = setup();
    state.requestInsights('hiragana');
    scheduler.runAll();
    scheduler.runAll();
    await settle();
    const ready = state.insights.value;

    env.version = 2;
    state.requestInsights('hiragana');
    expect(scheduler.pending).toBe(1);
    for (const listener of env.starts) listener();
    expect(scheduler.pending).toBe(0);
    // Nothing runs later, and the request can start again.
    scheduler.runAll();
    await settle();
    expect(state.insights.value?.forecast).toEqual({ kind: 'pending' });
    expect(ready?.forecast.kind).toBe('ready');
    state.requestInsights('hiragana');
    expect(scheduler.pending).toBe(1);
  });

  it('gives the same numbers for the same state', async () => {
    const one = setup();
    const two = setup();
    for (const { state, scheduler } of [one, two]) {
      state.requestInsights('hiragana');
      scheduler.runAll();
      scheduler.runAll();
      await settle();
    }
    expect(one.state.insights.value).toEqual(two.state.insights.value);
  });

  it('keeps the first forecast of a row and day, and not the next', async () => {
    const { state, scheduler, env, db } = setup();
    for (const version of [1, 2]) {
      env.version = version;
      state.requestInsights('hiragana');
      scheduler.runAll();
      scheduler.runAll();
      await settle();
    }
    expect(await db.getAll('forecasts')).toHaveLength(1);
  });

  it('after a reset the cleared records do not come back', async () => {
    const { state, scheduler, env, db } = setup();
    const run = async (): Promise<void> => {
      env.version += 1;
      state.requestInsights('hiragana');
      scheduler.runAll();
      scheduler.runAll();
      await settle();
    };
    await run();
    expect(await db.getAll('forecasts')).toHaveLength(1);

    // "Reset progress": the store is cleared underneath and the store tells its listeners.
    await db.write([{ op: 'clear', store: 'forecasts' }]);
    for (const listener of env.resets) listener();
    await run();
    // A cache that survived would still hold the key and write nothing.
    expect(await db.getAll('forecasts')).toHaveLength(1);
  });

  it('what got stronger after a first session lists the introduced kana', () => {
    const events: LogEvent[] = [
      start(0, { at: 1000, n: 1 }),
      intro(A, { at: 1001, n: 2 }),
      answer(A, { at: 1002, n: 3 }),
    ];
    const { state, scheduler, env } = setup(events);
    env.startSnapshot = folded([]).snapshot;
    state.requestInsights('hiragana');
    scheduler.runAll();
    const stronger = state.insights.value?.stronger;
    expect(stronger?.kind).toBe('ready');
    if (stronger?.kind === 'ready') expect(stronger.kana.map((s) => s.key)).toEqual([A]);
  });
});
