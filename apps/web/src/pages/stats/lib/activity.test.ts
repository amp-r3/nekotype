import { describe, it, expect } from 'vitest';
import type { LearnState, TestResult } from '@nekotype/shared/types';
import { initialLearnState, localDay } from '@/entities/learn';
import { activityDays, gridDays, levelOf, weeksFor } from './activity';
import { mondayOf } from './answer-time';

function state(parts: Partial<LearnState>): LearnState {
  return { ...initialLearnState(), ...parts };
}

function result(endedAt: number): TestResult {
  return {
    id: 'r',
    content: 'words',
    script: 'hiragana',
    strictness: 'learner',
    config: { kind: 'time', seconds: 60 },
    endReason: 'complete',
    repeated: false,
    startedAt: 0,
    endedAt,
    durationMs: 60_000,
    tokens: 100,
    erroredTokens: 5,
    items: 20,
    keystrokes: 150,
    rejectedKeystrokes: 6,
    assisted: 0,
    kpm: 100,
    kanaAccuracy: 0.95,
    celebratedPersonalBest: false,
    contentVersion: 'c',
    appVersion: 'a',
  };
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
      [],
    );
    expect(days.get(100)).toEqual({ answers: 7, tests: 0, active: false });
    expect(days.get(101)?.answers).toBe(1);
  });

  it('marks a run of active days, also without recall answers', () => {
    const days = activityDays(state({ activeDays: [[10, 12]] }), []);
    expect([...days.keys()]).toEqual([10, 11, 12]);
    expect(days.get(11)).toEqual({ answers: 0, tests: 0, active: true });
  });

  it('counts tests by the local day of endedAt, repeats included', () => {
    const endedAt = new Date(2026, 10, 3, 12).getTime();
    const day = localDay(endedAt);
    const days = activityDays(state({}), [result(endedAt), { ...result(endedAt), repeated: true }]);
    expect(days.get(day)).toEqual({ answers: 0, tests: 2, active: false });
  });
});

describe('weeksFor', () => {
  it('is 12 without a day, and between 12 and 26 otherwise', () => {
    expect(weeksFor(null, 1000)).toBe(12);
    expect(weeksFor(1000, 1000)).toBe(12);
    expect(weeksFor(1000 - 11 * 7, 1000)).toBe(12);
    expect(weeksFor(1000 - 12 * 7, 1000)).toBe(13);
    expect(weeksFor(1000 - 30 * 7, 1000)).toBe(26);
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
