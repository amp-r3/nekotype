import { describe, it, expect } from 'vitest';
import type { TestResult } from '@nekotype/shared/types';
import { loadResults } from './results';

function result(n: number): TestResult {
  return {
    id: `r${String(n)}`,
    content: 'words',
    script: 'hiragana',
    strictness: 'learner',
    config: { kind: 'zen' },
    endReason: 'complete',
    repeated: false,
    startedAt: n,
    endedAt: n,
    durationMs: 1,
    tokens: 1,
    erroredTokens: 0,
    items: 1,
    keystrokes: 1,
    rejectedKeystrokes: 0,
    assisted: 0,
    kpm: 1,
    kanaAccuracy: 1,
    celebratedPersonalBest: false,
    contentVersion: 'c',
    appVersion: 'a',
  };
}

// The store returns newest first.
const reader =
  (all: readonly TestResult[], calls: number[] = []) =>
  (offset: number, limit: number): Promise<TestResult[]> => {
    calls.push(offset);
    return Promise.resolve(all.slice(offset, offset + limit));
  };

describe('loadResults (S2)', () => {
  it('reads every page and returns the results oldest first', async () => {
    const all = Array.from({ length: 12 }, (_, i) => result(12 - i));
    const calls: number[] = [];
    const loaded = await loadResults(reader(all, calls), 5);
    expect(loaded.map((r) => r.endedAt)).toEqual([1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12]);
    expect(calls).toEqual([0, 5, 10]);
  });

  it('asks once more when the last page is exactly full', async () => {
    const all = [result(2), result(1)];
    const calls: number[] = [];
    expect((await loadResults(reader(all, calls), 2)).map((r) => r.endedAt)).toEqual([1, 2]);
    expect(calls).toEqual([0, 2]);
  });

  it('is empty without results', async () => {
    expect(await loadResults(reader([]))).toEqual([]);
  });
});
