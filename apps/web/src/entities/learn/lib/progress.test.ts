import { describe, it, expect } from 'vitest';
import { bestStreakOfDays, streakOfDays, streaks } from './progress';

const daysOf = (...days: number[]): Map<number, true> => new Map(days.map((day) => [day, true]));

describe('streaks of the days of the log', () => {
  it('reports the current and the best streak', () => {
    const days = daysOf(1, 2, 3, 6, 7);
    expect(streaks(days, 7)).toEqual({ current: 2, best: 3 });
    // Yesterday still counts while today has no answer; two days of silence end the run.
    expect(streaks(days, 8)).toEqual({ current: 2, best: 3 });
    expect(streaks(days, 20)).toEqual({ current: 0, best: 3 });
  });

  it('is zero without answers and counts a single day', () => {
    expect(streaks(daysOf(), 5)).toEqual({ current: 0, best: 0 });
    expect(bestStreakOfDays(daysOf(9))).toBe(1);
    expect(streakOfDays(daysOf(9), 9)).toBe(1);
  });

  it('does not depend on the order the days were added in', () => {
    expect(bestStreakOfDays(daysOf(10, 8, 9, 3))).toBe(3);
  });
});
