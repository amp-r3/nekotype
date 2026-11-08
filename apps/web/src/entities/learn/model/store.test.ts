import { describe, it, expect, vi } from 'vitest';
import type { LearnKanaKey, LearnState, Track } from '@nekotype/shared/types';
import { createMemoryDb } from '@/shared/lib';
import type { Db, Write } from '@/shared/lib';
import { createLearnStore } from './store';
import type { LearnStore } from './store';
import { ManualScheduler, SeededRng, TestClock } from './test-util';
import { keyOf, keysOfTrack } from '../lib/tracks';
import { isConfident } from '../lib/confidence';

const A = keyOf('hiragana', 'あ');
const KA = keyOf('hiragana', 'か');

function setup(options: { db?: Db; targetMs?: number } = {}) {
  const db = options.db ?? createMemoryDb();
  const clock = new TestClock();
  const scheduler = new ManualScheduler();
  const target = { ms: options.targetMs ?? 1500 };
  const store = createLearnStore({
    db: () => Promise.resolve(db),
    clock,
    scheduler,
    targetMs: () => target.ms,
  });
  return { db, clock, scheduler, store, target };
}

/** A fast, correct answer: one key at `ms`. */
function answer(store: LearnStore, key: LearnKanaKey, ms = 800, ok = true): number {
  return store.recordRecall({ key, keystrokes: [{ t: ms, accepted: true }], ok });
}

function recordedWrites(db: Db): Write[][] {
  const writes: Write[][] = [];
  const original = db.write.bind(db);
  db.write = (batch) => {
    writes.push([...batch]);
    return original(batch);
  };
  return writes;
}

describe('learn store: recall answers', () => {
  it('keeps the last 10 answers of a kana, oldest first', () => {
    const { store } = setup();
    for (let i = 0; i < 12; i++) answer(store, A, 1000 + i);
    const recent = store.state.value.recent[A] ?? [];
    expect(recent).toHaveLength(10);
    expect(recent.map((a) => a.ms)).toEqual([
      1002, 1003, 1004, 1005, 1006, 1007, 1008, 1009, 1010, 1011,
    ]);
  });

  it('gives every answer its own `at`, even within one millisecond', () => {
    const { store } = setup();
    answer(store, A);
    answer(store, A);
    const [first, second] = store.state.value.recent[A] ?? [];
    expect(second?.at).toBeGreaterThan(first?.at ?? Infinity);
  });

  it('stores the answer time and the outcome', () => {
    const { store } = setup();
    const ms = store.recordRecall({
      key: A,
      keystrokes: [
        { t: 800, accepted: true },
        { t: 1000, accepted: true },
        { t: 1200, accepted: true },
      ],
      ok: false,
    });
    expect(ms).toBe(800);
    expect(store.state.value.recent[A]).toEqual([expect.objectContaining({ ms: 800, ok: false })]);
  });

  it("does not count an answer's own intervals in its K, and switches K at the 20th interval", () => {
    const { store } = setup();
    // 19 intervals of 100 ms: K stays 200.
    for (let i = 0; i < 19; i++) {
      store.recordRecall({
        key: A,
        keystrokes: [
          { t: 500, accepted: true },
          { t: 600, accepted: true },
        ],
        ok: true,
      });
    }
    const three = [
      { t: 800, accepted: true },
      { t: 1000, accepted: true },
      { t: 1200, accepted: true },
    ];
    // This answer's own 200 ms intervals are not in K when it is computed: 20 intervals now exist
    // (19 + its own 2 would be 21), so K was still 200 → 800.
    expect(store.recordRecall({ key: A, keystrokes: three, ok: true })).toBe(800);
    // Now 21 intervals are recorded; K is their median (100 ms) → 1200 − 2 × 100.
    expect(store.recordRecall({ key: A, keystrokes: three, ok: true })).toBe(1000);
  });
});

describe('learn store: recognition and introduction', () => {
  it('counts recognitions and records a mixup of a wrong choice', () => {
    const { store } = setup();
    store.recordRecognition({ key: A, chosen: A });
    store.recordRecognition({ key: A, chosen: KA });
    store.recordRecognition({ key: A, chosen: KA });
    expect(store.state.value.stats[A]).toEqual({
      recognitions: 3,
      recognitionErrors: 2,
      mixups: { [KA]: 2 },
    });
  });

  it('creates an entry in box 0 on introduction, once, without an answer', () => {
    const { store, clock } = setup();
    store.introduce(A);
    const entry = store.state.value.entries[A];
    expect(entry).toEqual({ box: 0, dueAt: 0, updatedAt: clock.time });
    clock.advance(5000);
    store.introduce(A);
    expect(store.state.value.entries[A]).toEqual(entry);
    expect(store.state.value.recent[A]).toBeUndefined();
  });

  it('counts sessions', () => {
    const { store } = setup();
    store.countSession('started');
    store.countSession('started');
    store.countSession('finished');
    expect(store.counters.value).toEqual({
      started: { typing: 0, learn: 2 },
      finished: { typing: 0, learn: 1 },
    });
  });
});

describe('learn store: unlocking', () => {
  const vowels = keysOfTrack('hiragana').slice(0, 5);

  function makeConfident(store: LearnStore, keys: readonly LearnKanaKey[]): void {
    for (const key of keys) for (let i = 0; i < 10; i++) answer(store, key);
  }

  it('unlocks か when all five vowels are confident, and only then', () => {
    const { store } = setup();
    makeConfident(store, vowels.slice(0, 4));
    expect(store.state.value.unlocked.hiragana).toHaveLength(5);
    makeConfident(store, vowels.slice(4));
    expect(store.state.value.unlocked.hiragana).toHaveLength(6);
    expect(store.state.value.unlocked.hiragana.at(-1)).toBe(KA);
  });

  it('applies a changed target at once', () => {
    const { store, target } = setup();
    for (const key of vowels) for (let i = 0; i < 10; i++) answer(store, key, 1800);
    expect(store.state.value.unlocked.hiragana).toHaveLength(5);
    target.ms = 2000;
    answer(store, vowels[0] ?? A, 1800);
    expect(store.state.value.unlocked.hiragana).toHaveLength(6);
  });

  it('keeps the tracks independent', () => {
    const { store } = setup();
    for (const key of keysOfTrack('katakana').slice(0, 5)) makeConfident(store, [key]);
    expect(store.state.value.unlocked.katakana).toHaveLength(6);
    expect(store.state.value.unlocked.hiragana).toHaveLength(5);
  });

  it('never shrinks when a kana loses its confidence', () => {
    const { store } = setup();
    makeConfident(store, vowels);
    for (let i = 0; i < 10; i++) answer(store, A, 1000, false);
    expect(store.state.value.unlocked.hiragana).toContain(KA);
  });
});

// A simulated learner on a seeded Rng. Each round answers the unlocked kana that is not confident
// yet (the learner practises what is open), with random speed and errors.
function simulate(
  track: Track,
  seed: number,
  profile: { fastMs: number; slowMs: number; errorRate: number },
  maxAnswers = 40_000,
) {
  const { store, clock } = setup();
  const rng = new SeededRng(seed);
  const order: LearnKanaKey[] = [...store.state.value.unlocked[track]];
  let previous: LearnState = store.state.value;
  for (let step = 0; step < maxAnswers; step++) {
    const open = store.state.value.unlocked[track];
    const learning = open.filter((key) => !isConfident(store.state.value.recent[key] ?? [], 1500));
    const pool = learning.length > 0 ? learning : open;
    const key = pool[Math.floor(rng.next() * pool.length)];
    if (key === undefined) break;
    clock.advance(1000);
    const ms = profile.fastMs + rng.next() * (profile.slowMs - profile.fastMs);
    answer(store, key, Math.round(ms), rng.next() >= profile.errorRate);

    const now = store.state.value;
    const added = now.unlocked[track].filter((k) => !previous.unlocked[track].includes(k));
    // One at a time, and never fewer.
    expect(added.length).toBeLessThanOrEqual(1);
    expect(now.unlocked[track].length).toBeGreaterThanOrEqual(previous.unlocked[track].length);
    for (const k of added) {
      // Only when every kana unlocked before was confident.
      for (const u of previous.unlocked[track]) {
        expect(isConfident(now.recent[u] ?? [], 1500)).toBe(true);
      }
      order.push(k);
    }
    previous = now;
    if (now.unlocked[track].length === keysOfTrack(track).length && learning.length === 0) break;
  }
  return { state: store.state.value, order };
}

describe('learn store: unlocking properties (simulated learner)', () => {
  it('unlocks the whole hiragana track, one kana at a time, none of the unlearned ones', () => {
    const { state } = simulate('hiragana', 1, { fastMs: 700, slowMs: 1300, errorRate: 0.02 });
    expect(state.unlocked.hiragana).toEqual(keysOfTrack('hiragana'));
    for (const key of state.unlocked.hiragana) {
      expect([
        'っ',
        'ー',
        'ゃ',
        'ゅ',
        'ょ',
        'ぁ',
        'ぃ',
        'ぅ',
        'ぇ',
        'ぉ',
        'ゐ',
        'ゑ',
      ]).not.toContain(key.slice(9));
    }
  });

  it('unlocks ヴ before ヴァ and ヴィ in katakana', () => {
    const { state, order } = simulate('katakana', 2, { fastMs: 600, slowMs: 1200, errorRate: 0 });
    expect(state.unlocked.katakana).toEqual(keysOfTrack('katakana'));
    const at = (kana: string) => order.indexOf(keyOf('katakana', kana));
    expect(at('ヴ')).toBeGreaterThan(-1);
    expect(at('ヴ')).toBeLessThan(at('ヴァ'));
    expect(at('ヴ')).toBeLessThan(at('ヴィ'));
    // Only the vowels are open at the start; unlocking order follows the table otherwise.
    expect(at('ア')).toBeLessThan(at('カ'));
  });

  it('does not unlock past a kana the learner is slow at', () => {
    const { state } = simulate('hiragana', 3, { fastMs: 2000, slowMs: 2500, errorRate: 0 }, 2000);
    expect(state.unlocked.hiragana).toHaveLength(5);
  });

  it('gives the same result for the same seed', () => {
    const profile = { fastMs: 700, slowMs: 1600, errorRate: 0.05 };
    const first = simulate('hiragana', 7, profile, 3000);
    const second = simulate('hiragana', 7, profile, 3000);
    expect(second.state).toEqual(first.state);
    expect(second.order).toEqual(first.order);
  });
});

describe('learn store: persistence', () => {
  it('writes once per answer, after the handler, in one transaction', async () => {
    const { db, store, scheduler } = setup();
    const writes = recordedWrites(db);
    answer(store, A);
    expect(writes).toHaveLength(0);
    expect(scheduler.pending).toBe(1);
    scheduler.runAll();
    await store.flush();
    expect(writes).toHaveLength(1);
    expect(writes[0]?.map((w) => `${w.store}/${w.key}`)).toEqual([
      'delta/current',
      'meta/typingIntervals',
    ]);
  });

  it('joins several changes before the write into one', async () => {
    const { db, store, scheduler } = setup();
    const writes = recordedWrites(db);
    store.introduce(A);
    answer(store, A);
    expect(scheduler.pending).toBe(1);
    scheduler.runAll();
    await store.flush();
    expect(writes).toHaveLength(1);
    expect(scheduler.pending).toBe(0);
  });

  it('loads what was written, with the intervals that give K', async () => {
    const { db, store, scheduler } = setup();
    store.introduce(A);
    store.recordRecall({
      key: A,
      keystrokes: [
        { t: 500, accepted: true },
        { t: 650, accepted: true },
      ],
      ok: true,
    });
    store.countSession('started');
    scheduler.runAll();
    await store.flush();

    const next = setup({ db });
    await next.store.init();
    expect(next.store.ready.value).toBe(true);
    expect(next.store.state.value).toEqual(store.state.value);
    expect(next.store.counters.value.started.learn).toBe(1);
    expect(await db.get('meta', 'typingIntervals')).toEqual([150]);
  });

  it('unlocks on load when the stored answers allow it', async () => {
    const db = createMemoryDb();
    const first = setup({ db, targetMs: 1000 });
    for (const key of keysOfTrack('hiragana').slice(0, 5))
      for (let i = 0; i < 10; i++) answer(first.store, key, 1200);
    expect(first.store.state.value.unlocked.hiragana).toHaveLength(5);
    await first.store.flush();

    const second = setup({ db, targetMs: 1500 });
    await second.store.init();
    expect(second.store.state.value.unlocked.hiragana).toHaveLength(6);
  });

  it('takes the initial state for an invalid record', async () => {
    const db = createMemoryDb();
    await db.put('delta', 'current', { learn: { unlocked: 'x' }, counters: 1 });
    const { store } = setup({ db });
    await store.init();
    expect(store.ready.value).toBe(true);
    expect(store.state.value.unlocked.hiragana).toHaveLength(5);
    expect(store.state.value.entries).toEqual({});
  });

  it('works from memory when the database fails', async () => {
    const failing: Db = {
      ...createMemoryDb(),
      get: () => Promise.reject(new Error('closed')),
      write: () => Promise.reject(new Error('closed')),
    };
    const { store, scheduler } = setup({ db: failing });
    await store.init();
    expect(store.ready.value).toBe(true);
    answer(store, A);
    const run = vi.fn(() => {
      scheduler.runAll();
    });
    expect(run).not.toThrow();
    await expect(store.flush()).resolves.toBeUndefined();
    expect(store.state.value.recent[A]).toHaveLength(1);
  });

  it('reset clears the state, the counters and the stored record', async () => {
    const { db, store, scheduler } = setup();
    store.introduce(A);
    answer(store, A);
    store.countSession('started');
    scheduler.runAll();
    await store.flush();
    expect(await db.get('delta', 'current')).toBeDefined();

    await store.reset();
    expect(await db.get('delta', 'current')).toBeUndefined();
    expect(store.state.value.entries).toEqual({});
    expect(store.state.value.recent).toEqual({});
    expect(store.counters.value.started.learn).toBe(0);
    expect(scheduler.pending).toBe(0);
  });
});

describe('learn store: boxes, streak and buckets', () => {
  const A_DAY = 86_400_000;

  it('moves a kana from box 0 to box 1 at first confidence, not before', () => {
    const { store } = setup();
    store.introduce(A);
    for (let i = 0; i < 9; i++) answer(store, A, 1000);
    expect(store.state.value.entries[A]?.box).toBe(0);
    answer(store, A, 1000);
    expect(store.state.value.entries[A]?.box).toBe(1);
    expect(store.state.value.entries[A]?.dueAt).toBeGreaterThan(0);
  });

  it('does not move a box of 1 or higher by learning answers, even when due', () => {
    const { store, clock } = setup();
    store.introduce(A);
    for (let i = 0; i < 10; i++) answer(store, A, 1000);
    clock.advance(40 * A_DAY);
    answer(store, A, 1000, false);
    answer(store, A, 1000);
    expect(store.state.value.entries[A]?.box).toBe(1);
  });

  it('moves a box only by reviews', () => {
    const { store, clock } = setup();
    store.introduce(A);
    for (let i = 0; i < 10; i++) answer(store, A, 1000);
    clock.advance(2 * A_DAY);
    store.recordRecall({
      key: A,
      keystrokes: [{ t: 900, accepted: true }],
      ok: true,
      review: true,
    });
    expect(store.state.value.entries[A]?.box).toBe(2);
    store.recordRecall({
      key: A,
      keystrokes: [{ t: 900, accepted: false }],
      ok: false,
      review: true,
    });
    expect(store.state.value.entries[A]?.box).toBe(1);
  });

  it('makes a day active by an answer, not by an introduction', () => {
    const { store } = setup();
    store.introduce(A);
    expect(store.state.value.activeDays).toEqual([]);
    answer(store, A);
    expect(store.state.value.activeDays).toHaveLength(1);
  });

  it('makes a day active by a recognition answer', () => {
    const { store } = setup();
    store.recordRecognition({ key: A, chosen: A });
    expect(store.state.value.activeDays).toHaveLength(1);
  });

  it("counts a recall answer time in the track's bucket of the day", () => {
    const { store } = setup();
    answer(store, A, 850);
    answer(store, keyOf('katakana', 'ア'), 1250);
    const { hiragana, katakana } = store.state.value.recallBuckets;
    expect(Object.values(hiragana)).toEqual([{ '8': 1 }]);
    expect(Object.values(katakana)).toEqual([{ '12': 1 }]);
  });

  it('halves the recognition counters above 200', () => {
    const { store } = setup();
    for (let i = 0; i < 201; i++) store.recordRecognition({ key: A, chosen: KA });
    expect(store.state.value.stats[A]).toEqual({
      recognitions: 100,
      recognitionErrors: 100,
      mixups: { [KA]: 100 },
    });
  });
});
