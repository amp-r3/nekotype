import { describe, it, expect } from 'vitest';
import { buildPool, pickPrompt } from './picker';
import type { PoolSettings, PromptItem, ContentItem } from '../model/types';
import type { Rng } from '@/shared/lib';

class SeededRng implements Rng {
  private state: number;
  constructor(seed = 12345) {
    this.state = seed;
  }
  next(): number {
    this.state = (this.state * 1664525 + 1013904223) % 4294967296;
    return this.state / 4294967296;
  }
}

describe('picker: pool building', () => {
  it('offers mixed phrases only for both scripts and passes the Tatoeba id on', () => {
    const phrases: readonly ContentItem[] = [
      { id: 'p:1', text: 'ねこです。', script: 'hiragana', meaning: { en: 'a' }, tatoebaId: 1 },
      { id: 'p:2', text: 'トムです。', script: 'mixed', meaning: { en: 'b' }, tatoebaId: 2 },
    ];
    const keys = (script: PoolSettings['script']): (string | undefined)[] =>
      buildPool({ script, content: 'phrases' }, phrases).map((p) => p.key);
    expect(keys('hiragana')).toEqual(['p:1']);
    expect(keys('katakana')).toEqual([]);
    expect(keys('both')).toEqual(['p:1', 'p:2']);
    expect(buildPool({ script: 'both', content: 'phrases' }, phrases)[1]?.tatoebaId).toBe(2);
  });

  it('filters content by script in words mode', () => {
    const sampleWords: readonly ContentItem[] = [
      {
        id: 'word:neko',
        text: 'ねこ',
        script: 'hiragana',
        meaning: { en: 'Cat' },
      },
      {
        id: 'word:pan',
        text: 'パン',
        script: 'katakana',
        meaning: { en: 'Bread' },
      },
    ];

    const hSettings: PoolSettings = {
      script: 'hiragana',
      content: 'words',
    };
    const hPool = buildPool(hSettings, sampleWords);
    expect(hPool.length).toBe(1);
    expect(hPool[0]?.key).toBe('word:neko');

    const bothSettings: PoolSettings = {
      script: 'both',
      content: 'words',
    };
    const bothPool = buildPool(bothSettings, sampleWords);
    expect(bothPool.length).toBe(2);
  });

  it('has no prompts without content, with empty content or with nothing for the script', () => {
    const settings: PoolSettings = { script: 'hiragana', content: 'words' };
    expect(buildPool(settings)).toEqual([]);
    expect(buildPool(settings, [])).toEqual([]);

    const katakanaOnlyWords: readonly ContentItem[] = [
      {
        id: 'word:pan',
        text: 'パン',
        script: 'katakana',
        meaning: { en: 'Bread' },
      },
    ];
    expect(buildPool(settings, katakanaOnlyWords)).toEqual([]);
  });
});

describe('picker: prompt selection', () => {
  it('never returns the same item twice in a row when pool > 1', () => {
    const pool: PromptItem[] = [
      { key: 'a', text: 'あ' },
      { key: 'i', text: 'い' },
      { key: 'u', text: 'う' },
    ];
    const rng = new SeededRng(42);
    const weights = new Map<string, number>();

    let prevKey: string | null = null;
    for (let step = 0; step < 50; step++) {
      const picked = pickPrompt(pool, weights, rng, prevKey);
      expect(picked.key).not.toBe(prevKey);
      prevKey = picked.key;
    }
  });

  it('weights distribution towards higher-weighted items', () => {
    const pool: PromptItem[] = [
      { key: 'rare', text: 'あ' },
      { key: 'frequent', text: 'い' },
    ];
    const weights = new Map<string, number>([
      ['rare', 1],
      ['frequent', 9],
    ]);
    const rng = new SeededRng(100);

    const counts = { rare: 0, frequent: 0 };
    let prevKey: string | null = null;

    for (let i = 0; i < 200; i++) {
      const picked = pickPrompt(pool, weights, rng, prevKey);
      if (picked.key === 'rare') counts.rare++;
      if (picked.key === 'frequent') counts.frequent++;
      prevKey = picked.key;
    }

    // Since it cannot repeat immediately with length 2, it alternates.
    // Let's test with pool length 3 to see weighting effect
    const pool3: PromptItem[] = [
      { key: 'w1', text: 'あ' },
      { key: 'w2', text: 'い' },
      { key: 'w10', text: 'う' },
    ];
    const weights3 = new Map<string, number>([
      ['w1', 1],
      ['w2', 1],
      ['w10', 10],
    ]);
    const counts3 = { w1: 0, w2: 0, w10: 0 };
    prevKey = null;

    for (let i = 0; i < 300; i++) {
      const picked = pickPrompt(pool3, weights3, rng, prevKey);
      if (picked.key === 'w1') counts3.w1++;
      if (picked.key === 'w2') counts3.w2++;
      if (picked.key === 'w10') counts3.w10++;
      prevKey = picked.key;
    }

    expect(counts3.w10).toBeGreaterThan(counts3.w1);
    expect(counts3.w10).toBeGreaterThan(counts3.w2);
  });
});
