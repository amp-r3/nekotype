import { describe, it, expect } from 'vitest';
import { addBuckets, addRecallTime, dayAnswers, hasAnswers, quartilesOf } from './buckets';

describe('hasAnswers', () => {
  it('is false for no days and for a day with an empty bucket record', () => {
    expect(hasAnswers({})).toBe(false);
    expect(hasAnswers({ '5': {} })).toBe(false);
  });
  it('is true when some day has an answer', () => {
    expect(hasAnswers({ '5': {}, '6': { '8': 1 } })).toBe(true);
    expect(hasAnswers(addRecallTime({}, 1, 10_000))).toBe(true);
  });
});

describe('quartilesOf', () => {
  const of = (...ms: number[]): ReturnType<typeof quartilesOf> => {
    let days: Record<string, Record<string, number>> = {};
    for (const value of ms) days = addRecallTime(days, 1, value);
    return quartilesOf(days['1'] ?? {});
  };
  it('is null without answers', () => {
    expect(quartilesOf({})).toBeNull();
  });
  it('is one midpoint for one answer', () => {
    expect(of(1210)).toEqual({ lo: 1250, mid: 1250, hi: 1250 });
  });
  it('takes the 1st, 1st and 2nd of two answers', () => {
    expect(of(100, 900)).toEqual({ lo: 150, mid: 150, hi: 950 });
  });
  it('takes the 1st, 2nd and 3rd of four answers', () => {
    expect(of(100, 200, 300, 400)).toEqual({ lo: 150, mid: 250, hi: 350 });
  });
  it('takes the 2nd, 3rd and 4th of five answers', () => {
    expect(of(100, 200, 300, 400, 500)).toEqual({ lo: 250, mid: 350, hi: 450 });
  });
  it('follows a spread day', () => {
    const times = [...Array<number>(8).fill(500), ...Array<number>(8).fill(1500)];
    expect(of(...times)).toEqual({ lo: 550, mid: 550, hi: 1550 });
  });
});

describe('addBuckets and dayAnswers', () => {
  it('adds bucket-wise without changing the inputs', () => {
    const a = { '5': 2, '7': 1 };
    const b = { '7': 3, '9': 1 };
    expect(addBuckets(a, b)).toEqual({ '5': 2, '7': 4, '9': 1 });
    expect(a).toEqual({ '5': 2, '7': 1 });
  });
  it('counts the answers of a day, zero for a missing day', () => {
    let days = addRecallTime({}, 3, 500);
    days = addRecallTime(days, 3, 900);
    expect(dayAnswers(days, 3)).toBe(2);
    expect(dayAnswers(days, 4)).toBe(0);
  });
});
