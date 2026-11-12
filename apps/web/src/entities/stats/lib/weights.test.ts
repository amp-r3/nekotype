import { describe, it, expect } from 'vitest';
import { computeWeight, computeWeights, computeItemWeight } from './weights';

describe('kana weights', () => {
  it('weighs an unseen kana 3', () => {
    expect(computeWeight(undefined)).toBe(3.0);
    expect(computeWeight({ attempts: 0, erroredAttempts: 0 })).toBe(3.0);
  });

  it('weighs a strong kana close to 1', () => {
    // weakness = 1 / 32
    expect(computeWeight({ attempts: 30, erroredAttempts: 0 })).toBeCloseTo(1.125, 3);
  });

  it('weighs a weak kana close to 5', () => {
    // weakness = 11 / 12
    expect(computeWeight({ attempts: 10, erroredAttempts: 10 })).toBeCloseTo(4.667, 3);
  });

  it('gives the weights of a list of keys, unseen ones included', () => {
    const weights = computeWeights({ 'hiragana:あ': { attempts: 30, erroredAttempts: 0 } }, [
      'hiragana:あ',
      'hiragana:い',
    ]);
    expect(weights.get('hiragana:あ')).toBeCloseTo(1.125, 3);
    expect(weights.get('hiragana:い')).toBe(3);
  });

  it('weighs an item by the mean of its kana', () => {
    const weights = new Map([
      ['a', 1],
      ['b', 5],
    ]);
    expect(computeItemWeight(['a', 'b'], weights)).toBe(3);
    expect(computeItemWeight(['a', 'zz'], weights)).toBe(2);
    expect(computeItemWeight([], weights)).toBe(1);
  });
});
