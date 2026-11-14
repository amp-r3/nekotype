import { describe, it, expect } from 'vitest';
import type { TestResult, TypingRecords } from '@nekotype/shared/types';
import { personalBestKey } from '@nekotype/shared/runtime';
import type { ModeParts } from '@/entities/stats';
import { bestRows, historyPages, historyRow, kpmAxis, parseBestKey } from './typing-data';

function result(id: string, patch: Partial<TestResult> = {}): TestResult {
  return {
    id,
    content: 'words',
    script: 'hiragana',
    strictness: 'learner',
    config: { kind: 'time', seconds: 60 },
    endReason: 'complete',
    repeated: false,
    startedAt: 0,
    endedAt: 60_000,
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
    ...patch,
  };
}

describe('parseBestKey', () => {
  it.each<ModeParts>([
    {
      content: 'words',
      script: 'hiragana',
      strictness: 'learner',
      config: { kind: 'time', seconds: 60 },
    },
    {
      content: 'phrases',
      script: 'both',
      strictness: 'ime',
      config: { kind: 'count', prompts: 25 },
    },
    { content: 'words', script: 'katakana', strictness: 'ime', config: { kind: 'zen' } },
  ])('reads back the key of %j', (parts) => {
    expect(parseBestKey(personalBestKey(parts))).toEqual(parts);
  });

  it.each([
    '',
    'words|hiragana|learner',
    'words|hiragana|learner|time:60|x',
    'kanji|hiragana|learner|zen',
    'words|romaji|learner|zen',
    'words|hiragana|loose|zen',
    'words|hiragana|learner|time',
    'words|hiragana|learner|time:0',
    'words|hiragana|learner|time:6.5',
    'words|hiragana|learner|count:10:2',
    'words|hiragana|learner|laps:3',
  ])('rejects %j', (key) => {
    expect(parseBestKey(key)).toBeNull();
  });
});

describe('bestRows (T13)', () => {
  const label = (parts: ModeParts): string => personalBestKey(parts);

  it('lists every key with a best, sorted by its label, KPM as a whole number', () => {
    const records: TypingRecords = {
      'words|hiragana|learner|time:60': { best: { kpm: 84.4, resultId: 'a' }, recent: [] },
      'phrases|hiragana|learner|count:25': { best: { kpm: 61.5, resultId: 'b' }, recent: [] },
      // Results, but none eligible for a best.
      'words|katakana|learner|zen': { best: null, recent: [] },
      'not a key': { best: { kpm: 10, resultId: 'c' }, recent: [] },
    };
    expect(bestRows(records, label)).toEqual([
      {
        key: 'phrases|hiragana|learner|count:25',
        label: 'phrases|hiragana|learner|count:25',
        kpm: 62,
      },
      { key: 'words|hiragana|learner|time:60', label: 'words|hiragana|learner|time:60', kpm: 84 },
    ]);
  });

  it('is empty without records', () => {
    expect(bestRows({}, label)).toEqual([]);
  });
});

describe('kpmAxis', () => {
  it('is 0 / 60 / 120 of the design', () => {
    expect(kpmAxis([])).toEqual({ domain: [0, 120], ticks: [0, 60, 120] });
    expect(kpmAxis([40, 120])).toEqual({ domain: [0, 120], ticks: [0, 60, 120] });
  });

  it('grows in steps of 60 for a faster test', () => {
    expect(kpmAxis([84, 121])).toEqual({ domain: [0, 180], ticks: [0, 90, 180] });
    expect(kpmAxis([300.5])).toEqual({ domain: [0, 360], ticks: [0, 180, 360] });
  });
});

describe('history (T12)', () => {
  it('has 10 rows a page and at least one page', () => {
    expect(historyPages(0)).toBe(1);
    expect(historyPages(10)).toBe(1);
    expect(historyPages(11)).toBe(2);
    expect(historyPages(120)).toBe(12);
  });

  it('a row shows whole KPM, whole percent and seconds to 0.1', () => {
    const row = historyRow(
      result('r', { kpm: 84.6, kanaAccuracy: 0.9649, durationMs: 12_540, endedAt: 5 }),
      {},
    );
    expect(row).toEqual({
      id: 'r',
      endedAt: 5,
      content: 'words',
      config: { kind: 'time', seconds: 60 },
      repeated: false,
      kpm: 85,
      accuracy: 96,
      seconds: 12.5,
      best: false,
    });
  });

  it('marks only the result that is the current best of its key', () => {
    const records: TypingRecords = {
      'words|hiragana|learner|time:60': { best: { kpm: 100, resultId: 'new' }, recent: [] },
    };
    expect(historyRow(result('new'), records).best).toBe(true);
    // An earlier best that was beaten, and the same id under another key.
    expect(historyRow(result('old'), records).best).toBe(false);
    expect(historyRow(result('new', { script: 'katakana' }), records).best).toBe(false);
  });
});
