import { describe, it, expect, vi } from 'vitest';
import { createMemoryDb } from '@/shared/lib';
import { canonicalFor } from '@/entities/prompt';
import { createLearnStore, initialCounters } from '@/entities/learn';
import { createLearnSession } from './session';
import type { TaskPort } from './session';
import { Clock0, Timers, answers, key, seededRng, stateWith } from '../lib/test-util';
import { reviewQueue } from '../lib/review-queue';

const port: TaskPort = {
  setBuffer: () => undefined,
  type: () => undefined,
  reject: () => undefined,
  finish: () => undefined,
  reset: () => undefined,
};

async function setup() {
  const clock = new Clock0();
  const scheduler = new Timers();
  const db = createMemoryDb();
  const day = 24 * 3600 * 1000;
  const learn = stateWith({
    entries: {
      あ: { box: 2, dueAt: clock.time - 2 * day },
      い: { box: 3, dueAt: clock.time - day },
      う: { box: 1, dueAt: clock.time + 5 * day },
    },
    // Confident: only a confident kana is due (ADR 062).
    recent: { あ: answers(10, 900), い: answers(10, 900), う: answers(10, 900) },
  });
  await db.put('delta', 'learn', { learn, counters: initialCounters() });
  const store = createLearnStore({
    db: () => Promise.resolve(db),
    clock,
    scheduler,
    targetMs: () => 1500,
  });
  await store.init();
  const queue = reviewQueue(store.state.value, 'hiragana', 1500, clock.now());
  const play = vi.fn();
  const session = createLearnSession({
    track: 'hiragana',
    mode: 'review',
    queue,
    store,
    clock,
    scheduler,
    rng: seededRng(3),
    audio: { play },
    strictness: () => 'learner',
    targetMs: () => 1500,
  });
  return { clock, scheduler, store, session, queue, play };
}

describe('review session', () => {
  it('asks one recall per due kana, oldest first, and ends on the summary', async () => {
    const env = await setup();
    expect(env.queue).toEqual([key('あ'), key('い')]);
    expect(env.session.mode).toBe('review');
    expect(env.session.total).toBe(2);
    env.session.start();
    expect(env.store.counters.value.started.learn).toBe(1);
    const seen: string[] = [];
    while (env.session.phase.value === 'task') {
      const task = env.session.task.value;
      if (task === null) throw new Error('no task');
      expect(task.kind).toBe('recall');
      seen.push(task.key);
      env.session.attach(port);
      env.clock.time += 600;
      for (const char of canonicalFor(task.key)) env.session.handleIntent({ kind: 'char', char });
      env.scheduler.flush();
    }
    expect(seen).toEqual([key('あ'), key('い')]);
    expect(env.session.phase.value).toBe('summary');
    expect(env.store.counters.value.finished.learn).toBe(1);
  });

  it('moves boxes on each answer: up when correct, back to box 1 after an error', async () => {
    const env = await setup();
    env.session.start();
    // あ: correct.
    env.session.attach(port);
    env.clock.time += 600;
    for (const char of canonicalFor(key('あ'))) env.session.handleIntent({ kind: 'char', char });
    expect(env.store.state.value.entries[key('あ')]?.box).toBe(3);
    env.scheduler.flush();
    // い: a rejected key first.
    env.session.attach(port);
    env.session.handleIntent({ kind: 'char', char: 'x' });
    for (const char of canonicalFor(key('い'))) env.session.handleIntent({ kind: 'char', char });
    expect(env.store.state.value.entries[key('い')]?.box).toBe(1);
  });

  it('introduces nothing and plays the kana', async () => {
    const env = await setup();
    env.session.start();
    expect(env.session.task.value?.kind).toBe('recall');
    expect(env.store.state.value.entries[key('え')]).toBeUndefined();
  });
});
