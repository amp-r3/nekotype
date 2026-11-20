import { describe, it, expect } from 'vitest';
import type { LearnState } from '@nekotype/shared/types';
import { initialLearnState } from '@/entities/learn';
import { activeDaysIn, activityDays, fitMap, gridDays, levelOf } from './activity';
import { mondayOf } from './days';

function state(parts: Partial<LearnState>): LearnState {
  return { ...initialLearnState(), ...parts };
}

describe('levelOf', () => {
  it.each([
    [0, 0],
    [1, 1],
    [9, 1],
    [10, 2],
    [24, 2],
    [25, 3],
    [49, 3],
    [50, 4],
    [99, 4],
    [100, 5],
  ])('%i answers is level %i', (answers, level) => {
    expect(levelOf(answers, false)).toBe(level);
  });

  it('draws an active day without answers at level 1', () => {
    expect(levelOf(0, true)).toBe(1);
    expect(levelOf(30, true)).toBe(3);
  });
});

describe('activityDays', () => {
  it('adds up the answers of both tracks and all buckets', () => {
    const days = activityDays(
      state({
        recallBuckets: {
          hiragana: { '100': { '3': 2, '5': 1 } },
          katakana: { '100': { '4': 4 }, '101': { '2': 1 } },
        },
      }),
      200,
    );
    expect(days.get(100)).toEqual({ answers: 7, active: false, run: false });
    expect(days.get(101)?.answers).toBe(1);
  });

  it('marks a run of active days, also without recall answers', () => {
    const days = activityDays(state({ activeDays: [[10, 12]] }), 100);
    expect([...days.keys()]).toEqual([10, 11, 12]);
    expect(days.get(11)).toEqual({ answers: 0, active: true, run: false });
  });

  it('marks the days of the current streak: the last run, ending today or yesterday', () => {
    const runs: LearnState['activeDays'] = [
      [1, 3],
      [10, 12],
    ];
    const ending = (today: number): number[] =>
      [...activityDays(state({ activeDays: runs }), today)]
        .filter(([, day]) => day.run)
        .map(([key]) => key);
    expect(ending(12)).toEqual([10, 11, 12]);
    expect(ending(13)).toEqual([10, 11, 12]);
    expect(ending(14)).toEqual([]);
  });
});

describe('activeDaysIn', () => {
  const runs: LearnState['activeDays'] = [
    [60, 70],
    [90, 99],
    [100, 100],
  ];
  it('counts the days of the last 30 only', () => {
    // The window of today = 100 is days 71–100.
    expect(activeDaysIn(state({ activeDays: runs }), 100, 30)).toBe(11);
    expect(activeDaysIn(state({ activeDays: [[60, 80]] }), 100, 30)).toBe(10);
    expect(activeDaysIn(state({}), 100, 30)).toBe(0);
  });
  it('does not count days after today', () => {
    expect(activeDaysIn(state({ activeDays: [[98, 105]] }), 100, 30)).toBe(3);
  });
});

describe('fitMap', () => {
  it('takes as many weeks as fit at 16 px, at most 26, and grows the cells up to 28 px', () => {
    expect(fitMap(null)).toEqual({ weeks: 12, cell: 16 });
    // A phone: 328 px less the weekday column.
    const phone = fitMap(328);
    expect(phone.weeks).toBe(15);
    expect(phone.cell).toBe(16);
    const desktop = fitMap(828);
    expect(desktop.weeks).toBe(26);
    // (828 − 32 − 25 × 4) / 26: the cells share the width exactly.
    expect(desktop.cell).toBeCloseTo(26.77, 2);
    expect(fitMap(2000)).toEqual({ weeks: 26, cell: 28 });
  });
  it('never has fewer than one week or cells under 16 px', () => {
    expect(fitMap(10).weeks).toBe(1);
    expect(fitMap(10).cell).toBe(16);
  });
});

describe('gridDays', () => {
  it('ends today and starts on a Monday', () => {
    const monday = mondayOf(20_400);
    const days = gridDays(monday, 12);
    expect(days).toHaveLength(11 * 7 + 1);
    expect(days.at(-1)).toBe(monday);
    expect(mondayOf(days[0] ?? 0)).toBe(days[0]);
  });

  it('fills the last column up to Sunday', () => {
    const sunday = mondayOf(20_400) + 6;
    const days = gridDays(sunday, 12);
    expect(days).toHaveLength(12 * 7);
    expect(days.at(-1)).toBe(sunday);
  });
});
