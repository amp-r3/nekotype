import { describe, expect, it } from 'vitest';
import { basicIds, hiraganaItems } from './items';
import { createLearner, DAY_MS } from './learner';
import { createCurrentPolicy } from './policies/current';
import { createRng } from './rng';
import { simulate } from './run';

const items = hiraganaItems();

describe('items', () => {
  it('has the 104 hiragana of the track, 46 of them basic', () => {
    expect(items).toHaveLength(104);
    expect(basicIds(items)).toHaveLength(46);
  });

  it('derives dependencies by the rule of learning.md', () => {
    const id = (kana: string): number => items.findIndex((item) => item.kana === kana);
    expect(items[id('が')]?.parts).toEqual([id('か')]);
    expect(items[id('きゃ')]?.parts).toEqual([id('き'), id('や')]);
    expect(items[id('あ')]?.parts).toEqual([]);
  });
});

describe('reference learner', () => {
  it('forgets with time and never recalls a kana it has not seen', () => {
    const learner = createLearner(items, 'beginner', 0, createRng(1));
    expect(learner.recallProbability(7, 0)).toBe(0);
    learner.study(7, 0);
    const soon = learner.recallProbability(7, 60_000);
    const later = learner.recallProbability(7, DAY_MS);
    expect(soon).toBeGreaterThan(later);
    expect(later).toBeGreaterThan(0);
  });

  it('starts a knower with the basic kana remembered', () => {
    const learner = createLearner(items, 'knower', 0, createRng(3));
    for (const id of basicIds(items)) expect(learner.recallProbability(id, 0)).toBeGreaterThan(0.9);
  });
});

describe('simulate', () => {
  it('gives the same result for the same seed', () => {
    const a = simulate(createCurrentPolicy, 'beginner', 5, 5);
    const b = simulate(createCurrentPolicy, 'beginner', 5, 5);
    expect(a).toEqual(b);
  });

  it('stays within the sittings of the routine', () => {
    const result = simulate(createCurrentPolicy, 'beginner', 6, 5);
    expect(result.minutesPerDay).toBeLessThanOrEqual(12);
    expect(result.unlocked).toBeGreaterThan(5);
  });
});
