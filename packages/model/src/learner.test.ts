import { describe, expect, it } from 'vitest';
import { DAY_MS, HORIZON_DEFAULT_MS } from './constants';
import { createFold } from './fold';
import type { ModelState } from './fold';
import { intervalFactor } from './fsrs';
import {
  dueFrom,
  horizonMs,
  learningLimit,
  pressure,
  recallsToLearn,
  requestedRetention,
} from './learner';

const withLearner = (over: Partial<ModelState['learner']>): ModelState => {
  const base = createFold({ targetMs: 1500, stats: false }).state;
  return { ...base, learner: { ...base.learner, ...over } };
};

describe('pressure and what follows from it', () => {
  it('is 0 at the goal and above it', () => {
    for (const observed of [0.9, 0.95, 1]) {
      const s = withLearner({ observed });
      expect(pressure(s)).toBe(0);
      expect(requestedRetention(s)).toBe(0.9);
      expect(learningLimit(s)).toBe(5);
      expect(recallsToLearn(s)).toBe(5);
    }
  });
  it('is 1 at 10 points below the goal and lower', () => {
    for (const observed of [0.8, 0.5]) {
      const s = withLearner({ observed });
      expect(pressure(s)).toBeCloseTo(1, 10);
      expect(requestedRetention(s)).toBeCloseTo(0.98, 10);
      expect(learningLimit(s)).toBe(1);
      expect(recallsToLearn(s)).toBe(7);
    }
  });
  it('is linear between', () => {
    const s = withLearner({ observed: 0.86 });
    expect(pressure(s)).toBeCloseTo(0.4, 10);
    expect(requestedRetention(s)).toBeCloseTo(0.932, 10);
    expect(learningLimit(s)).toBe(3); // round(5 − 1.6)
    expect(recallsToLearn(s)).toBe(6);
  });
});

describe('horizonMs', () => {
  it('is the default without gaps', () => {
    expect(horizonMs(withLearner({}))).toBe(HORIZON_DEFAULT_MS);
  });
  it('is the element at floor(length / 2) of the sorted gaps', () => {
    expect(horizonMs(withLearner({ gaps: [5, 1, 3] }))).toBe(3);
    expect(horizonMs(withLearner({ gaps: [4, 1, 3, 2] }))).toBe(3);
  });
});

describe('dueFrom', () => {
  it('is null for a new or learning kana', () => {
    const fold = createFold({ targetMs: 1500, stats: false });
    expect(dueFrom(fold.state, 'hiragana:か')).toBeNull();
    fold.apply({ t: 'intro', k: 'hiragana:か', at: 0, dev: 'd', n: 1 });
    expect(dueFrom(fold.state, 'hiragana:か')).toBeNull();
  });
  it('is lastAt + stability × intervalFactor(r) days, minus the horizon', () => {
    const base = createFold({ targetMs: 1500, stats: false }).state;
    const items = new Map(base.items).set('hiragana:か', {
      phase: 'learned',
      memory: { stability: 10, difficulty: 5 },
      lastAt: 1000,
      lastDay: 0,
      streak: 5,
      lastTask: 0,
    });
    const s: ModelState = { ...base, items };
    expect(dueFrom(s, 'hiragana:か')).toBeCloseTo(
      1000 + 10 * intervalFactor(0.9) * DAY_MS - HORIZON_DEFAULT_MS,
      3,
    );
  });
});
