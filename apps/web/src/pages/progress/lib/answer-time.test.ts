import { describe, it, expect } from 'vitest';
import type { DayLog } from '@nekotype/model';
import { dayBars, hasRecall, msAxis, quartilesOf, spanDays } from './answer-time';

/** Days with the recall times of hiragana (and, as `katakana`, of the other track). */
function withTimes(
  entries: readonly (readonly [number, number])[],
  katakana: readonly (readonly [number, number])[] = [],
): Map<number, DayLog> {
  const days = new Map<number, { hiragana: number[]; katakana: number[] }>();
  const at = (day: number): { hiragana: number[]; katakana: number[] } => {
    const have = days.get(day) ?? { hiragana: [], katakana: [] };
    days.set(day, have);
    return have;
  };
  for (const [day, ms] of entries) at(day).hiragana.push(ms);
  for (const [day, ms] of katakana) at(day).katakana.push(ms);
  return new Map(
    [...days].map(([day, recall]) => [
      day,
      { answers: recall.hiragana.length + recall.katakana.length, recall },
    ]),
  );
}

describe('quartilesOf', () => {
  it('takes the exact ⌈n/4⌉-th and ⌈3n/4⌉-th shortest times and the median', () => {
    // n = 8: ranks 2, 6; the median is the mean of the 4th and 5th.
    expect(quartilesOf([800, 100, 700, 200, 600, 300, 500, 400])).toEqual({
      lo: 200,
      mid: 450,
      hi: 600,
    });
    // n = 5: ranks 2 and 4, the median is the 3rd.
    expect(quartilesOf([5, 1, 4, 2, 3])).toEqual({ lo: 2, mid: 3, hi: 4 });
  });
  it('is the one time for one answer and null for none', () => {
    expect(quartilesOf([731])).toEqual({ lo: 731, mid: 731, hi: 731 });
    expect(quartilesOf([])).toBeNull();
  });
  it('keeps the exact time, not the midpoint of a bucket', () => {
    expect(quartilesOf([1234])).toEqual({ lo: 1234, mid: 1234, hi: 1234 });
  });
});

describe('dayBars', () => {
  it('has a bar per day with answers and none for a gap day', () => {
    const days = withTimes([
      [100, 1000],
      [100, 1400],
      [102, 900],
    ]);
    const { weekly, bars } = dayBars(days, 'hiragana', '7', 102);
    expect(weekly).toBe(false);
    expect(bars.map((bar) => bar.day)).toEqual([100, 102]);
    expect(bars[0]).toEqual({ day: 100, answers: 2, lo: 1000, mid: 1200, hi: 1400 });
  });

  it('keeps the tracks apart', () => {
    const days = withTimes([[100, 1000]], [[99, 700]]);
    expect(dayBars(days, 'katakana', '7', 100).bars.map((bar) => bar.day)).toEqual([99]);
    expect(hasRecall(days, 'katakana')).toBe(true);
    expect(hasRecall(withTimes([[1, 5]]), 'katakana')).toBe(false);
  });

  it('leaves out days outside the period', () => {
    const days = withTimes([
      [60, 1000],
      [100, 1000],
    ]);
    expect(dayBars(days, 'hiragana', '30', 100).bars.map((bar) => bar.day)).toEqual([100]);
    expect(dayBars(days, 'hiragana', 'all', 100).bars.map((bar) => bar.day)).toEqual([60, 100]);
  });

  it('is by day up to 45 days and by week over it', () => {
    expect(dayBars(withTimes([[100 - 44, 1000]]), 'hiragana', 'all', 100).weekly).toBe(false);
    const wide = dayBars(withTimes([[100 - 45, 1000]]), 'hiragana', 'all', 100);
    expect(wide.weekly).toBe(true);
    expect(wide.span).toBe(46);
  });

  it('joins the answers of a Monday-to-Sunday week and drops nothing older than a year', () => {
    // Day 4 is Monday 1970-01-05; 4..10 is one week, 11 starts the next.
    const days = withTimes([
      [4, 500],
      [10, 1500],
      [11, 2500],
      [1000, 1000],
    ]);
    const { weekly, bars } = dayBars(days, 'hiragana', 'all', 1000);
    expect(weekly).toBe(true);
    expect(bars.map((bar) => [bar.day, bar.answers])).toEqual([
      [4, 2],
      [11, 1],
      [998, 1],
    ]);
    expect(bars[0]).toMatchObject({ lo: 500, mid: 1000, hi: 1500 });
  });
});

describe('spanDays', () => {
  it('is the length of the period, or runs from the first recall of the track for all', () => {
    const days = withTimes([[80, 1]], [[90, 1]]);
    expect(spanDays(days, 'hiragana', '7', 100)).toBe(7);
    expect(spanDays(days, 'hiragana', 'all', 100)).toBe(21);
    expect(spanDays(days, 'katakana', 'all', 100)).toBe(14);
  });
});

describe('msAxis', () => {
  const bar = (lo: number, hi: number): Parameters<typeof msAxis>[0][number] => ({
    day: 1,
    answers: 1,
    lo,
    mid: lo,
    hi,
  });
  it('holds every lo and hi, in steps of 250 for a narrow range', () => {
    const axis = msAxis([bar(1100, 1350)]);
    expect(axis.domain).toEqual([1000, 1500]);
    expect(axis.ticks).toEqual([1000, 1250, 1500]);
  });
  it('widens the step to keep at most four intervals', () => {
    const axis = msAxis([bar(800, 3100)]);
    expect(axis.domain[0]).toBeLessThanOrEqual(800);
    expect(axis.domain[1]).toBeGreaterThan(3100);
    expect(axis.ticks.length).toBeLessThanOrEqual(5);
  });
  it('never puts the highest hi on the top edge, and is 0–1000 ms without bars', () => {
    expect(msAxis([bar(1000, 1500)]).domain[1]).toBeGreaterThan(1500);
    expect(msAxis([]).domain).toEqual([0, 1000]);
  });
});
