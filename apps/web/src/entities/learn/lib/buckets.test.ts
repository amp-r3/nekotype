import { describe, it, expect } from 'vitest';
import {
  addBuckets,
  addRecallTime,
  dailyMedian,
  dailyMedians,
  dayAnswers,
  quartilesOf,
} from './buckets';

describe('daily median', () => {
  it('is the midpoint of the bucket of the ⌈n / 2⌉-th shortest time', () => {
    let days = {};
    for (const ms of [850, 1210, 990]) days = addRecallTime(days, 7, ms);
    // sorted: 850 (bucket 8), 990 (9), 1210 (12); the 2nd is in bucket 9.
    expect(dailyMedian(days, 7)).toBe(950);
  });
  it('takes the lower middle of an even count', () => {
    let days = {};
    for (const ms of [100, 200, 300, 400]) days = addRecallTime(days, 7, ms);
    expect(dailyMedian(days, 7)).toBe(250);
  });
  it('puts a capped time in bucket 100', () => {
    expect(dailyMedian(addRecallTime({}, 1, 10_000), 1)).toBe(10_050);
  });
  it('is null for a day without answers', () => {
    expect(dailyMedian({}, 1)).toBeNull();
  });
  it('lists the days of a track in order and drops days over 365 days old', () => {
    let hiragana = addRecallTime({}, 1, 500);
    hiragana = addRecallTime(hiragana, 400, 700);
    hiragana = addRecallTime(hiragana, 300, 900);
    expect(dailyMedians({ hiragana, katakana: {} }, 'hiragana')).toEqual([
      { day: 300, ms: 950 },
      { day: 400, ms: 750 },
    ]);
    expect(dailyMedians({ hiragana, katakana: {} }, 'katakana')).toEqual([]);
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
