import { describe, expect, it } from 'vitest';
import type { LearnEntry } from '@nekotype/shared/types';
import { emptyLearnState } from '@nekotype/shared/runtime';
import { settingsAt } from '../model/test-util';
import { buildBatch, noCounters, noLearnChanges } from './build-batch';
import type { BatchInput } from './build-batch';

const entry: LearnEntry = { box: 1, dueAt: 10, updatedAt: 5 };

const input = (over: Partial<BatchInput> = {}): BatchInput => ({
  deviceId: 'dev',
  seq: 4,
  learn: noLearnChanges(),
  settings: null,
  ...over,
});

describe('buildBatch', () => {
  it('returns null when there is nothing to send', () => {
    expect(buildBatch(input(), 1_000_000)).toBeNull();
  });

  it('sends the counters of the learning delta', () => {
    const batch = buildBatch(
      input({ learn: { learn: emptyLearnState(), counters: { started: 2, finished: 1 } } }),
      1_000_000,
    );
    expect(batch?.request.delta.counters).toEqual({ started: 2, finished: 1 });
    expect(batch?.rest.counters).toEqual(noCounters());
  });

  it('carries the settings alone', () => {
    const batch = buildBatch(input({ settings: settingsAt(9) }), 1_000_000);
    expect(batch?.request.delta.settings?.updatedAt).toBe(9);
    expect(batch?.request.seq).toBe(4);
  });

  it('returns null when the batch does not fit', () => {
    const learn = {
      learn: { ...emptyLearnState(), entries: { 'hiragana:あ': entry } },
      counters: noCounters(),
    };
    expect(buildBatch(input({ learn }), 20)).toBeNull();
  });

  it('caps the learning part and leaves the rest', () => {
    const entries: Record<string, LearnEntry> = {};
    for (let i = 0; i < 61; i += 1) entries[`hiragana:k${String(i).padStart(2, '0')}`] = entry;
    const batch = buildBatch(
      input({ learn: { learn: { ...emptyLearnState(), entries }, counters: noCounters() } }),
      1_000_000,
    );
    expect(Object.keys(batch?.request.delta.learn.entries ?? {})).toHaveLength(60);
    expect(Object.keys(batch?.rest.learn.entries ?? {})).toEqual(['hiragana:k60']);
  });
});
