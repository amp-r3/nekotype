import { describe, it, expect } from 'vitest';
import { addActiveDay, bestStreak, currentStreak } from './streak';

describe('active days', () => {
  it('start a run, extend it and join two runs', () => {
    let runs = addActiveDay([], 10);
    expect(runs).toEqual([[10, 10]]);
    runs = addActiveDay(runs, 11);
    expect(runs).toEqual([[10, 11]]);
    runs = addActiveDay(runs, 13);
    expect(runs).toEqual([
      [10, 11],
      [13, 13],
    ]);
    runs = addActiveDay(runs, 12);
    expect(runs).toEqual([[10, 13]]);
    runs = addActiveDay(runs, 5);
    expect(runs).toEqual([
      [5, 5],
      [10, 13],
    ]);
  });
  it('return the same runs for a day that is already active', () => {
    const runs = [[10, 13]] as const;
    expect(addActiveDay(runs, 12)).toBe(runs);
  });
});

describe('streak', () => {
  const runs = [
    [1, 5],
    [10, 12],
  ] as const;
  it('counts the run that ends today', () => {
    expect(currentStreak(runs, 12)).toBe(3);
  });
  it('counts the run that ended yesterday while today has no answer', () => {
    expect(currentStreak(runs, 13)).toBe(3);
  });
  it('is 0 after a missed day, and keeps the best', () => {
    expect(currentStreak(runs, 14)).toBe(0);
    expect(bestStreak(runs)).toBe(5);
  });
  it('is 0 with no days', () => {
    expect(currentStreak([], 5)).toBe(0);
    expect(bestStreak([])).toBe(0);
  });
});
