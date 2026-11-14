import { describe, it, expect } from 'vitest';
import { initialLearnState } from './state';
import { masteredCount, streaks, trackProgress } from './progress';
import { addActiveDay } from './streak';

describe('learning progress', () => {
  it('counts nothing mastered in an empty state', () => {
    const state = initialLearnState();
    expect(masteredCount(state, 'hiragana', 1500)).toBe(0);
    expect(trackProgress(state, 'katakana', 1500)).toEqual({
      mastered: 0,
      total: 125,
    });
  });

  it('reports the current and the best streak', () => {
    const base = initialLearnState();
    let runs = base.activeDays;
    for (const day of [1, 2, 3, 6, 7]) runs = addActiveDay(runs, day);
    const state = { ...base, activeDays: runs };
    expect(streaks(state, 7)).toEqual({ current: 2, best: 3 });
    expect(streaks(state, 20)).toEqual({ current: 0, best: 3 });
  });
});
