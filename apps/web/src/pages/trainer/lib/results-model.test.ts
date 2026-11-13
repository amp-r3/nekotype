import { describe, it, expect } from 'vitest';
import type { TestResult } from '@nekotype/shared/types';
import { kpmComparisons, signed, weakKana } from './results-model';

const result = (kpm: number): TestResult => ({
  id: 'r',
  content: 'words',
  script: 'hiragana',
  strictness: 'learner',
  config: { kind: 'time', seconds: 60 },
  endReason: 'complete',
  repeated: false,
  startedAt: 0,
  endedAt: 60000,
  durationMs: 60000,
  tokens: 100,
  erroredTokens: 0,
  items: 10,
  keystrokes: 100,
  rejectedKeystrokes: 0,
  assisted: 0,
  kpm,
  kanaAccuracy: 1,
  celebratedPersonalBest: false,
  contentVersion: 't',
  appVersion: 't',
});

describe('signed', () => {
  it('uses U+2212 for a minus and no sign for zero', () => {
    expect(signed(8)).toBe('+8');
    expect(signed(-9)).toBe('−9');
    expect(signed(0)).toBe('0');
  });
});

describe('kpmComparisons', () => {
  it('has no comparisons without earlier tests', () => {
    expect(kpmComparisons(result(92.4), null, null)).toEqual({
      kpm: 92,
      average: null,
      best: null,
    });
  });

  it('compares with the average and the best', () => {
    const c = kpmComparisons(result(92), 84.2, 101);
    expect(c.average).toEqual({ delta: '+8', reference: 84 });
    expect(c.best).toEqual({ delta: '−9', reference: 101 });
  });

  it('shows the whole numbers it compares', () => {
    const c = kpmComparisons(result(84.4), 84.6, null);
    // 84 against 85, as the screen shows them.
    expect(c.average).toEqual({ delta: '−1', reference: 85 });
  });
});

describe('weakKana', () => {
  it('lists up to five kana with errors, the most first, with the spellings of the strictness', () => {
    const errors = {
      'hiragana:つ': 3,
      'hiragana:あ': 0,
      'hiragana:ふ': 1,
      'hiragana:い': 2,
      'hiragana:う': 2,
      'hiragana:え': 2,
      'hiragana:お': 2,
    };
    const items = weakKana(errors, 'learner');
    expect(items).toHaveLength(5);
    expect(items[0]).toMatchObject({ glyph: 'つ', errors: 3 });
    expect(items[0]?.spellings).toEqual(['tsu', 'tu']);
    expect(items.map((i) => i.glyph)).not.toContain('あ');
    expect(items.map((i) => i.glyph)).not.toContain('ふ');
    // Strict IME accepts no more than relaxed.
    const strict = weakKana(errors, 'ime')[0]?.spellings ?? [];
    expect(strict.length).toBeLessThanOrEqual(items[0]?.spellings.length ?? 0);
    expect(strict[0]).toBe('tsu');
  });

  it('counts errors, not errored kana: three wrong keys on one kana are 3', () => {
    expect(weakKana({ 'hiragana:ど': 3 }, 'learner')[0]?.errors).toBe(3);
  });

  it('is empty without errors', () => {
    expect(weakKana({ 'hiragana:あ': 0 }, 'learner')).toEqual([]);
    expect(weakKana({}, 'learner')).toEqual([]);
  });
});
