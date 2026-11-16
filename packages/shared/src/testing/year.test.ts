import { describe, it, expect } from 'vitest';
import { isCounters, isLearnState, isTestResult, isTypingRecords } from '../runtime';
import { BATCH_CAPS, generateBatch, generateYear, KANA_KEYS } from './index';

const size = (value: unknown): number => new TextEncoder().encode(JSON.stringify(value)).length;

describe('generateYear', () => {
  const year = generateYear({ seed: 1, keys: KANA_KEYS });

  it('has the shape of a year of learning on both tracks (ADR 078)', () => {
    expect(isLearnState(year.learn)).toBe(true);
    expect(isCounters(year.counters)).toBe(true);
    expect(isTypingRecords(year.typingRecords)).toBe(true);
    expect(Object.keys(year.learn.entries)).toHaveLength(229);
    expect(Object.values(year.learn.recent).every((list) => list.length === 10)).toBe(true);
    expect(Object.keys(year.learn.recallBuckets.hiragana)).toHaveLength(365);
    expect(Object.keys(year.learn.recallBuckets.katakana)).toHaveLength(365);
    expect(Object.keys(year.typingRecords)).toHaveLength(12);
    expect(Object.keys(year.deviceSeq)).toHaveLength(3);
  });

  it('holds the three learning columns within 10% of 300 KB', () => {
    const { recent, recallBuckets, ...rest } = year.learn;
    const total = size(rest) + size(recent) + size(recallBuckets);
    expect(total).toBeGreaterThan(270_000);
    expect(total).toBeLessThan(330_000);
  });

  it('gives the same data for the same seed and other data for another', () => {
    expect(generateYear({ seed: 1, keys: KANA_KEYS })).toEqual(year);
    expect(generateYear({ seed: 2, keys: KANA_KEYS })).not.toEqual(year);
  });
});

describe('generateBatch', () => {
  const kana = (kind: 'learning' | 'capped' | 'results') =>
    Object.keys(generateBatch({ seed: 3, keys: KANA_KEYS, kind }).delta.learn.recent).length;

  it('is the same for the same seed', () => {
    const a = generateBatch({ seed: 3, keys: KANA_KEYS, kind: 'results' });
    expect(generateBatch({ seed: 3, keys: KANA_KEYS, kind: 'results' })).toEqual(a);
  });

  it('learning: 30 kana of one track, one day, no results', () => {
    const batch = generateBatch({ seed: 3, keys: KANA_KEYS, kind: 'learning' });
    expect(kana('learning')).toBe(30);
    expect(Object.keys(batch.delta.learn.recallBuckets.hiragana)).toHaveLength(1);
    expect(Object.keys(batch.delta.learn.recallBuckets.katakana)).toHaveLength(0);
    expect(batch.results).toHaveLength(0);
  });

  it('capped: the caps of both tracks', () => {
    const batch = generateBatch({ seed: 3, keys: KANA_KEYS, kind: 'capped' });
    expect(kana('capped')).toBe(BATCH_CAPS.kana);
    for (const track of ['hiragana', 'katakana'] as const) {
      expect(Object.keys(batch.delta.learn.recallBuckets[track])).toHaveLength(BATCH_CAPS.days);
    }
  });

  it('results: 50 valid results and no learning', () => {
    const batch = generateBatch({ seed: 3, keys: KANA_KEYS, kind: 'results' });
    expect(batch.results).toHaveLength(50);
    expect(batch.results.every(isTestResult)).toBe(true);
    expect(new Set(batch.results.map((r) => r.id)).size).toBe(50);
    expect(kana('results')).toBe(0);
  });

  it('stays under the 256 KB body limit', () => {
    for (const kind of ['learning', 'capped', 'results'] as const) {
      expect(size(generateBatch({ seed: 3, keys: KANA_KEYS, kind }))).toBeLessThan(256 * 1024);
    }
  });
});
