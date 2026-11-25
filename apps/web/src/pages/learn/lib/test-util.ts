import { describe, foldLog } from '@nekotype/model';
import type { LearnView } from '@nekotype/model';
import { answer, intro } from '@nekotype/model/testing';
import type {
  Clock,
  LearnKanaKey,
  LogEvent,
  Rng,
  Scheduler,
  TimeoutHandle,
} from '@nekotype/shared/types';
import { createLearnStore, keyOf } from '@/entities/learn';
import type { LearnStore } from '@/entities/learn';
import { createMemoryDb } from '@/shared/lib';
import type { Db } from '@/shared/lib';

export { answer, intro };

/** Mulberry32: a small seeded generator with good low bits, for statistical tests. */
export function seededRng(seed: number): Rng {
  let state = seed >>> 0;
  return {
    next() {
      state = (state + 0x6d2b79f5) >>> 0;
      let t = state;
      t = Math.imul(t ^ (t >>> 15), t | 1);
      t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
      return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
    },
  };
}

export const key = (kana: string): LearnKanaKey => keyOf('hiragana', kana);

/** Tests only: numbers the events of one device and folds them into a view. */
export function viewOfEvents(events: readonly LogEvent[]): LearnView {
  const numbered = events.map((event, index) => ({ ...event, dev: 'd1', n: index + 1 }));
  const snapshot = foldLog(numbered, { stats: true }).snapshot();
  if (snapshot.stats === null) throw new Error('the fold has no statistics');
  return describe(snapshot.state, snapshot.stats);
}

/** An introduction and five fast, correct recalls 40 s apart: the kana is learned at the end. */
export function learnedEvents(kana: string, at: number): LogEvent[] {
  return [
    intro(key(kana), { at }),
    ...Array.from({ length: 5 }, (_, i) =>
      answer(key(kana), { at: at + 40_000 * (i + 1), ms: 900 }),
    ),
  ];
}

export class Clock0 implements Clock {
  time = 1_700_000_000_000;
  now(): number {
    return this.time;
  }
}

export class Timers implements Scheduler {
  private nextId = 1;
  readonly tasks = new Map<number, () => void>();
  setTimeout(fn: () => void): TimeoutHandle {
    const id = this.nextId++;
    this.tasks.set(id, fn);
    return { id };
  }
  clearTimeout(handle: TimeoutHandle): void {
    if (typeof handle.id === 'number') this.tasks.delete(handle.id);
  }
  setInterval(fn: () => void): TimeoutHandle {
    return this.setTimeout(fn);
  }
  clearInterval(handle: TimeoutHandle): void {
    this.clearTimeout(handle);
  }
  /** Runs the timers that are pending now, once. */
  flush(): void {
    const due = [...this.tasks.values()];
    this.tasks.clear();
    for (const fn of due) fn();
  }
}

let ids = 0;

/** A learn store on a memory database with the real model, loaded; the clock and timers are the test's. */
export async function readyStore(
  clock: Clock,
  scheduler: Scheduler,
  db: Db = createMemoryDb(),
): Promise<LearnStore> {
  const store = createLearnStore({
    db: () => Promise.resolve(db),
    clock,
    scheduler,
    loadModel: () => import('@nekotype/model'),
    newId: () => `018f0000-0000-7000-8000-${String(ids++).padStart(12, '0')}`,
    tz: () => -new Date().getTimezoneOffset(),
  });
  await store.init();
  return store;
}

/** Introduces a kana and answers it five times, fast and right, 40 s apart: it is learned. */
export function learnKana(store: LearnStore, clock: Clock0, kana: string): void {
  store.introduce(key(kana));
  for (let i = 0; i < 5; i++) {
    clock.time += 40_000;
    store.recordAnswer({
      task: 'recall',
      key: key(kana),
      ok: true,
      keystrokes: [{ t: 700, accepted: true }],
      hint: false,
      wrong: null,
      alt: null,
    });
  }
}

/**
 * Writes a log into `db` through a store of its own, the way the app would have, for a page test
 * that then renders the page on the same database. `build` plays the history on a clock it moves.
 */
export async function seedLog(
  db: Db,
  from: number,
  build: (store: LearnStore, clock: Clock0) => void,
): Promise<void> {
  const clock = new Clock0();
  clock.time = from;
  const timers = new Timers();
  const store = await readyStore(clock, timers, db);
  store.startSession();
  build(store, clock);
  timers.flush();
  await store.flush();
}
