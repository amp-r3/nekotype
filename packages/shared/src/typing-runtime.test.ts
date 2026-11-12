import { describe, it, expect } from 'vitest';
import {
  addKanaStats,
  applyResultToRecords,
  averageKpm,
  decayKanaStat,
  isBestEligible,
  isKanaStat,
  isTestResult,
  isTypingRecords,
  personalBestKey,
  roundAccuracy,
  roundKpm,
} from './runtime';
import type { TestResult, TypingRecords } from './types';

const result = (over: Partial<TestResult> = {}): TestResult => ({
  id: 'r0',
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
  rejectedKeystrokes: 5,
  assisted: 0,
  kpm: 100,
  kanaAccuracy: 0.95,
  celebratedPersonalBest: false,
  contentVersion: 'c1',
  appVersion: 'a1',
  ...over,
});

const KEY = 'words|hiragana|learner|time:60';

/** Applies results in order, as the client does one test after another. */
function applyAll(results: readonly TestResult[]) {
  let records: TypingRecords = {};
  let last = applyResultToRecords(records, result({ id: 'x', repeated: true }));
  for (const r of results) {
    last = applyResultToRecords(records, r);
    records = last.records;
  }
  return last;
}

const earlier = (n: number, kpm = 50): TestResult[] =>
  Array.from({ length: n }, (_, i) =>
    result({ id: `e${String(i).padStart(2, '0')}`, endedAt: 1000 + i, kpm }),
  );

describe('personalBestKey', () => {
  it('formats every config kind', () => {
    expect(personalBestKey(result())).toBe(KEY);
    expect(
      personalBestKey(
        result({
          content: 'phrases',
          script: 'both',
          strictness: 'ime',
          config: { kind: 'count', prompts: 25 },
        }),
      ),
    ).toBe('phrases|both|ime|count:25');
    expect(personalBestKey(result({ script: 'katakana', config: { kind: 'zen' } }))).toBe(
      'words|katakana|learner|zen',
    );
  });
  it('accepts the bare parts of a configuration', () => {
    expect(
      personalBestKey({
        content: 'words',
        script: 'hiragana',
        strictness: 'learner',
        config: { kind: 'time', seconds: 15 },
      }),
    ).toBe('words|hiragana|learner|time:15');
  });
});

describe('isBestEligible', () => {
  it('needs accuracy of at least 0.8', () => {
    expect(isBestEligible(result({ kanaAccuracy: 0.8 }))).toBe(true);
    expect(isBestEligible(result({ kanaAccuracy: 0.7999 }))).toBe(false);
  });
  it('needs a complete test that is not a repeat', () => {
    expect(isBestEligible(result({ repeated: true }))).toBe(false);
    for (const endReason of ['manual', 'idle', 'hidden'] as const) {
      expect(isBestEligible(result({ endReason }))).toBe(false);
    }
  });
});

describe('rounding', () => {
  it('rounds KPM to 0.1 and accuracy to 4 decimals', () => {
    expect(roundKpm(123.456)).toBe(123.5);
    expect(roundKpm(99.94)).toBe(99.9);
    expect(roundAccuracy(0.123456)).toBe(0.1235);
    expect(roundAccuracy(1)).toBe(1);
  });
});

describe('averageKpm', () => {
  it('is null without an entry or results', () => {
    expect(averageKpm(undefined)).toBeNull();
    expect(averageKpm({ best: null, recent: [] })).toBeNull();
  });
  it('is the mean of recent', () => {
    const recent = [20, 40].map((kpm, i) => ({ resultId: `a${i}`, endedAt: i, kpm }));
    expect(averageKpm({ best: null, recent })).toBe(30);
  });
});

describe('applyResultToRecords: average', () => {
  it('has no average before the first result', () => {
    expect(applyAll([result()]).average).toBeNull();
  });
  it.each([1, 10, 12])('is the mean of the %i earlier results (at most 10)', (n) => {
    const olds = earlier(n, 50);
    // The oldest two of 12 are 10 and 30, the rest 50: only the last 10 count.
    const mixed = olds.map((r, i) => (n === 12 && i < 2 ? { ...r, kpm: i === 0 ? 10 : 30 } : r));
    const applied = applyAll([...mixed, result({ id: 'now', endedAt: 5000, kpm: 90 })]);
    expect(applied.average).toBe(50);
  });
  it('leaves a repeat out of the average', () => {
    const applied = applyAll([
      ...earlier(2, 50),
      result({ id: 'rep', endedAt: 3000, kpm: 500, repeated: true }),
      result({ id: 'now', endedAt: 4000, kpm: 80 }),
    ]);
    expect(applied.average).toBe(50);
  });
  it('counts a result that is not eligible for the best', () => {
    const applied = applyAll([
      result({ id: 'idle', endedAt: 1, kpm: 30, endReason: 'idle' }),
      result({ id: 'now', endedAt: 2 }),
    ]);
    expect(applied.average).toBe(30);
  });
  it('keeps keys apart', () => {
    const applied = applyAll([
      result({ id: 'a', endedAt: 1, kpm: 30, config: { kind: 'time', seconds: 15 } }),
      result({ id: 'now', endedAt: 2 }),
    ]);
    expect(applied.average).toBeNull();
  });
});

describe('applyResultToRecords: best', () => {
  it('takes the first eligible result as the best', () => {
    const applied = applyAll([result({ id: 'a', kpm: 70 })]);
    expect(applied.isBest).toBe(true);
    expect(applied.previousBest).toBeNull();
    expect(applied.records[KEY]?.best).toEqual({ kpm: 70, resultId: 'a' });
  });
  it('reports the best before the test', () => {
    const applied = applyAll([
      result({ id: 'a', endedAt: 1, kpm: 70 }),
      result({ id: 'b', endedAt: 2, kpm: 90 }),
    ]);
    expect(applied.previousBest).toBe(70);
    expect(applied.isBest).toBe(true);
    expect(applied.records[KEY]?.best).toEqual({ kpm: 90, resultId: 'b' });
  });
  it('keeps the best when the result is lower or equal', () => {
    for (const kpm of [60, 70]) {
      const applied = applyAll([
        result({ id: 'a', endedAt: 1, kpm: 70 }),
        result({ id: 'b', endedAt: 2, kpm }),
      ]);
      expect(applied.isBest).toBe(false);
      expect(applied.records[KEY]?.best).toEqual({ kpm: 70, resultId: 'a' });
    }
  });
  it('comes only from eligible results', () => {
    for (const over of [
      { endReason: 'idle' as const },
      { endReason: 'hidden' as const },
      { endReason: 'manual' as const },
      { kanaAccuracy: 0.79 },
    ]) {
      const applied = applyAll([result({ kpm: 500, ...over })]);
      expect(applied.isBest).toBe(false);
      expect(applied.records[KEY]?.best).toBeNull();
    }
  });
  it('is not changed by a repeat, which leaves the records as they were', () => {
    const first = applyAll([result({ id: 'a', kpm: 70 })]).records;
    const applied = applyResultToRecords(first, result({ id: 'r', kpm: 200, repeated: true }));
    expect(applied.records).toBe(first);
    expect(applied.isBest).toBe(false);
    expect(applied.average).toBe(70);
    expect(applied.previousBest).toBe(70);
  });
});

describe('applyResultToRecords: recent', () => {
  it('keeps the 10 latest, oldest first', () => {
    const applied = applyAll(earlier(12));
    const recent = applied.records[KEY]?.recent ?? [];
    expect(recent).toHaveLength(10);
    expect(recent.map((r) => r.resultId)).toEqual(
      Array.from({ length: 10 }, (_, i) => `e${String(i + 2).padStart(2, '0')}`),
    );
  });
  it('orders by endedAt, then by id', () => {
    const applied = applyAll([
      result({ id: 'b', endedAt: 5 }),
      result({ id: 'c', endedAt: 1 }),
      result({ id: 'a', endedAt: 5 }),
    ]);
    expect(applied.records[KEY]?.recent.map((r) => r.resultId)).toEqual(['c', 'a', 'b']);
  });
  it('does not add the same result twice', () => {
    const once = applyAll([result({ id: 'a' })]).records;
    const twice = applyResultToRecords(once, result({ id: 'a' })).records;
    expect(twice[KEY]?.recent).toHaveLength(1);
  });
  it('does not mutate the records it was given', () => {
    const before = applyAll([result({ id: 'a' })]).records;
    const snapshot = JSON.stringify(before);
    applyResultToRecords(before, result({ id: 'b', endedAt: 9, kpm: 999 }));
    expect(JSON.stringify(before)).toBe(snapshot);
  });
});

describe('kana statistics', () => {
  it('adds counters', () => {
    expect(addKanaStats(undefined, { attempts: 3, erroredAttempts: 1 })).toEqual({
      attempts: 3,
      erroredAttempts: 1,
    });
    expect(
      addKanaStats({ attempts: 3, erroredAttempts: 1 }, { attempts: 2, erroredAttempts: 2 }),
    ).toEqual({ attempts: 5, erroredAttempts: 3 });
  });
  it('decays above 200 attempts only', () => {
    const at200 = { attempts: 200, erroredAttempts: 51 };
    expect(decayKanaStat(at200)).toBe(at200);
    expect(decayKanaStat({ attempts: 201, erroredAttempts: 51 })).toEqual({
      attempts: 100,
      erroredAttempts: 25,
    });
  });
});

describe('guards', () => {
  it('accepts a valid result and rejects malformed ones', () => {
    expect(isTestResult(result())).toBe(true);
    expect(isTestResult(result({ config: { kind: 'zen' } }))).toBe(true);
    expect(isTestResult(null)).toBe(false);
    expect(isTestResult({ ...result(), endReason: 'crash' })).toBe(false);
    expect(isTestResult({ ...result(), config: { kind: 'time' } })).toBe(false);
    expect(isTestResult({ ...result(), id: '' })).toBe(false);
    expect(isTestResult({ ...result(), kanaAccuracy: 1.2 })).toBe(false);
    expect(isTestResult({ ...result(), kpm: Number.NaN })).toBe(false);
    expect(isTestResult({ ...result(), tokens: 1.5 })).toBe(false);
    expect(isTestResult({ ...result(), erroredTokens: 101 })).toBe(false);
    expect(isTestResult({ ...result(), repeated: 'no' })).toBe(false);
  });
  it('checks kana statistics', () => {
    expect(isKanaStat({ attempts: 2, erroredAttempts: 1 })).toBe(true);
    expect(isKanaStat({ attempts: 1, erroredAttempts: 2 })).toBe(false);
    expect(isKanaStat({ attempts: -1, erroredAttempts: 0 })).toBe(false);
    expect(isKanaStat({ attempts: 1 })).toBe(false);
  });
  it('checks typing records', () => {
    const good = applyAll(earlier(3)).records;
    expect(isTypingRecords(good)).toBe(true);
    expect(isTypingRecords({})).toBe(true);
    expect(isTypingRecords([])).toBe(false);
    expect(isTypingRecords({ k: { best: undefined, recent: [] } })).toBe(false);
    expect(isTypingRecords({ k: { best: { kpm: 1 }, recent: [] } })).toBe(false);
    expect(isTypingRecords({ k: { best: null, recent: [{ resultId: 'a' }] } })).toBe(false);
    expect(
      isTypingRecords({
        k: {
          best: null,
          recent: Array.from({ length: 11 }, (_, i) => ({ resultId: `a${i}`, endedAt: i, kpm: 1 })),
        },
      }),
    ).toBe(false);
  });
});
