import { describe, it, expect } from 'vitest';
import { addRecallTime } from '@/entities/learn';
import type { DayBuckets } from '@nekotype/shared/types';
import { dayBars, mondayOf, msAxis } from './answer-time';

function withAnswers(entries: readonly (readonly [number, number])[]): DayBuckets {
  let days: DayBuckets = {};
  for (const [day, ms] of entries) days = addRecallTime(days, day, ms);
  return days;
}

describe('dayBars', () => {
  it('has a bar per day with answers and none for a gap day', () => {
    const days = withAnswers([
      [100, 1000],
      [100, 1400],
      [102, 900],
    ]);
    const { weekly, bars } = dayBars(days, '7', 102);
    expect(weekly).toBe(false);
    expect(bars.map((bar) => bar.day)).toEqual([100, 102]);
    expect(bars[0]).toEqual({ day: 100, answers: 2, lo: 1050, mid: 1050, hi: 1450 });
  });

  it('leaves out days outside the period', () => {
    const days = withAnswers([
      [60, 1000],
      [100, 1000],
    ]);
    expect(dayBars(days, '30', 100).bars.map((bar) => bar.day)).toEqual([100]);
    expect(dayBars(days, 'all', 100).bars.map((bar) => bar.day)).toEqual([60, 100]);
  });

  it('is by day up to 45 days and by week over it', () => {
    expect(dayBars(withAnswers([[100 - 44, 1000]]), 'all', 100).weekly).toBe(false);
    const wide = dayBars(withAnswers([[100 - 45, 1000]]), 'all', 100);
    expect(wide.weekly).toBe(true);
    expect(wide.span).toBe(46);
  });

  it('adds the buckets of a Monday-to-Sunday week first', () => {
    // Day 4 is Monday 1970-01-05; 4..10 is one week, 11 starts the next.
    const days = withAnswers([
      [4, 500],
      [10, 1500],
      [11, 2500],
      [100, 1000],
    ]);
    const { weekly, bars } = dayBars(days, 'all', 100);
    expect(weekly).toBe(true);
    expect(bars.map((bar) => [bar.day, bar.answers])).toEqual([
      [4, 2],
      [11, 1],
      [95, 1],
    ]);
    expect(bars[0]).toMatchObject({ lo: 550, mid: 550, hi: 1550 });
  });
});

describe('mondayOf', () => {
  it('maps every day of a week to its Monday, also before 1970', () => {
    for (let day = 4; day <= 10; day++) expect(mondayOf(day)).toBe(4);
    expect(mondayOf(-3)).toBe(-3);
    expect(mondayOf(0)).toBe(-3);
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
  it('holds the target and every lo and hi, in steps of 250 for a narrow range', () => {
    const axis = msAxis([bar(1100, 1350)], 1500);
    expect(axis.domain).toEqual([1000, 1750]);
    expect(axis.ticks).toEqual([1000, 1250, 1500, 1750]);
  });
  it('widens the step to keep at most four intervals', () => {
    const axis = msAxis([bar(800, 3100)], 1500);
    expect(axis.domain[0]).toBeLessThanOrEqual(800);
    expect(axis.domain[1]).toBeGreaterThan(3100);
    expect(axis.ticks.length).toBeLessThanOrEqual(5);
  });
  it('holds the target without bars and never puts it on the top edge', () => {
    const axis = msAxis([], 1500);
    expect(axis.domain[0]).toBeLessThanOrEqual(1500);
    expect(axis.domain[1]).toBeGreaterThan(1500);
  });
});
