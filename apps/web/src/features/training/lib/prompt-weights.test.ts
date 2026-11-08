import { describe, it, expect } from 'vitest';
import type { PromptItem } from '@/entities/prompt';
import { allKanaRows } from '@/entities/prompt';
import type { KanaStats } from '@/entities/stats';
import { computeWeight } from '@/entities/stats';
import { createPromptWeights } from './prompt-weights';

const stat = (a: number, m: number): KanaStats => ({ a, m, t: 300 });

describe('createPromptWeights (D20: computeItemWeight for words and phrases)', () => {
  it('a word with a weak kana outweighs a word of strong kana', () => {
    const weights = createPromptWeights();
    const stats = new Map<string, KanaStats>([
      ['hiragana:ね', stat(10, 10)],
      ['hiragana:あ', stat(20, 0)],
      ['hiragana:い', stat(20, 0)],
    ]);
    const pool: PromptItem[] = [
      { key: 'w:neko', text: 'ねこ' },
      { key: 'w:ai', text: 'あい' },
    ];
    const result = weights(pool, stats);
    expect(result.get('w:neko')).toBeGreaterThan(result.get('w:ai') ?? Infinity);
  });

  it('a word weighs the mean of its kana weights; unseen kana count as unseen (3)', () => {
    const weights = createPromptWeights();
    const stats = new Map<string, KanaStats>([['hiragana:ね', stat(10, 10)]]);
    const result = weights([{ key: 'w:neko', text: 'ねこ' }], stats);
    expect(result.get('w:neko')).toBeCloseTo((computeWeight(stat(10, 10)) + 3) / 2, 10);
  });

  it('skips tokens without a KanaKey (ー) instead of diluting the mean', () => {
    const weights = createPromptWeights();
    const stats = new Map<string, KanaStats>([['katakana:コ', stat(10, 10)]]);
    const result = weights([{ key: 'w:coffee', text: 'コーヒー' }], stats);
    expect(result.get('w:coffee')).toBeCloseTo((computeWeight(stat(10, 10)) + 3) / 2, 10);
  });

  it('a prompt with no statistics weighs the unseen default, as before', () => {
    const result = createPromptWeights()([{ key: 'w:neko', text: 'ねこ' }], new Map());
    expect(result.get('w:neko')).toBe(3);
  });

  it('single kana weigh exactly what they weighed before the change', () => {
    const pool: PromptItem[] = allKanaRows.flatMap((row) =>
      row.entries.flatMap((entry) => [
        ...(entry.hiragana
          ? [{ key: `hiragana:${entry.hiragana}`, text: entry.hiragana } satisfies PromptItem]
          : []),
        { key: `katakana:${entry.katakana}`, text: entry.katakana } satisfies PromptItem,
      ]),
    );
    const stats = new Map<string, KanaStats>([
      ['hiragana:あ', stat(30, 3)],
      ['katakana:ン', stat(5, 5)],
      ['hiragana:きゃ', stat(12, 1)],
    ]);
    const result = createPromptWeights()(pool, stats);
    expect(result.size).toBe(pool.length);
    for (const item of pool) {
      expect(result.get(item.key)).toBe(computeWeight(stats.get(item.key)));
    }
  });
});
