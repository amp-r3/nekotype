import { describe, it, expect } from 'vitest';
import {
  addCounters,
  addLearnStats,
  isCounters,
  isLearnState,
  mergeEntries,
  mergeEntry,
  mergeRecent,
  mergeUnlocked,
} from './runtime';
import type { Counters, LearnEntry, LearnKanaKey, LearnState, RecallAnswer } from './types';

const A: LearnKanaKey = 'hiragana:あ';
const I: LearnKanaKey = 'hiragana:い';
const U: LearnKanaKey = 'hiragana:う';
const answer = (at: number, ms = 1000, ok = true): RecallAnswer => ({ at, ms, ok });

describe('mergeUnlocked', () => {
  it('is the union in track order', () => {
    expect(mergeUnlocked([A, I, U], [U, A], [I])).toEqual([A, I, U]);
  });
  it('does not depend on the argument order', () => {
    expect(mergeUnlocked([A, I, U], [I], [A])).toEqual(mergeUnlocked([A, I, U], [A], [I]));
  });
  it('keeps a kana outside the order, after the others', () => {
    expect(mergeUnlocked([A, I], [I], ['hiragana:ゑ'])).toEqual([I, 'hiragana:ゑ']);
  });
});

describe('mergeRecent', () => {
  it('unites answers by `at`', () => {
    expect(mergeRecent([answer(1), answer(2)], [answer(2), answer(3)]).map((a) => a.at)).toEqual([
      1, 2, 3,
    ]);
  });
  it('keeps the 10 latest, oldest first', () => {
    const many = Array.from({ length: 8 }, (_, i) => answer(i));
    const more = Array.from({ length: 8 }, (_, i) => answer(i + 8));
    const merged = mergeRecent(many, more);
    expect(merged).toHaveLength(10);
    expect(merged[0]?.at).toBe(6);
    expect(merged[9]?.at).toBe(15);
  });
  it('is idempotent and commutative', () => {
    const x = [answer(1, 900), answer(4)];
    const y = [answer(1, 700), answer(2, 500, false)];
    expect(mergeRecent(x, x)).toEqual(x);
    expect(mergeRecent(x, y)).toEqual(mergeRecent(y, x));
  });
});

describe('mergeEntry', () => {
  const entry = (box: LearnEntry['box'], updatedAt: number, dueAt = 0): LearnEntry => ({
    box,
    dueAt,
    updatedAt,
  });
  it('last write wins', () => {
    expect(mergeEntry(entry(1, 5), entry(3, 9))).toEqual(entry(3, 9));
    expect(mergeEntry(entry(3, 9), entry(1, 5))).toEqual(entry(3, 9));
  });
  it('decides a tie the same way in both orders', () => {
    expect(mergeEntry(entry(2, 5), entry(3, 5))).toEqual(entry(3, 5));
    expect(mergeEntry(entry(3, 5), entry(2, 5))).toEqual(entry(3, 5));
    expect(mergeEntry(entry(3, 5, 10), entry(3, 5, 20))).toEqual(entry(3, 5, 20));
  });
  it('merges records per kana', () => {
    const merged = mergeEntries(
      { [A]: entry(1, 1), [I]: entry(1, 8) },
      { [I]: entry(2, 3), [U]: entry(0, 2) },
    );
    expect(merged[A]?.box).toBe(1);
    expect(merged[I]?.box).toBe(1);
    expect(merged[U]?.box).toBe(0);
  });
});

describe('counters and stats are added', () => {
  const c = (n: number): Counters => ({
    started: { typing: n, learn: 2 * n },
    finished: { typing: 3 * n, learn: 4 * n },
  });
  it('addCounters', () => {
    expect(addCounters(c(1), c(2))).toEqual(c(3));
    expect(isCounters(addCounters(c(1), c(2)))).toBe(true);
  });
  it('addLearnStats adds mixups', () => {
    const sum = addLearnStats(
      { recognitions: 3, recognitionErrors: 1, mixups: { [I]: 1 } },
      { recognitions: 2, recognitionErrors: 2, mixups: { [I]: 2, [U]: 1 } },
    );
    expect(sum).toEqual({ recognitions: 5, recognitionErrors: 3, mixups: { [I]: 3, [U]: 1 } });
  });
});

describe('isLearnState', () => {
  const state: LearnState = {
    unlocked: { hiragana: [A], katakana: [] },
    entries: { [A]: { box: 0, dueAt: 0, updatedAt: 1 } },
    recent: { [A]: [answer(1)] },
    stats: { [A]: { recognitions: 0, recognitionErrors: 0, mixups: {} } },
  };
  it('accepts a valid state', () => {
    expect(isLearnState(state)).toBe(true);
  });
  it('rejects broken shapes', () => {
    expect(isLearnState(null)).toBe(false);
    expect(isLearnState({ ...state, unlocked: { hiragana: ['x'], katakana: [] } })).toBe(false);
    expect(isLearnState({ ...state, entries: { [A]: { box: 9, dueAt: 0, updatedAt: 1 } } })).toBe(
      false,
    );
    expect(
      isLearnState({ ...state, recent: { [A]: Array.from({ length: 11 }, (_, i) => answer(i)) } }),
    ).toBe(false);
    expect(isLearnState({ ...state, stats: { bad: state.stats[A] } })).toBe(false);
  });
});
