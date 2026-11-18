import { describe, expect, it } from 'vitest';
import type { LearnEntry } from '@nekotype/shared/types';
import { emptyLearnState } from '@nekotype/shared/runtime';
import { result, settingsAt } from '../model/test-util';
import { bodyBytes, buildBatch, noCounters, noLearnChanges } from './build-batch';
import type { BatchInput } from './build-batch';

const entry: LearnEntry = { box: 1, dueAt: 10, updatedAt: 5 };

const input = (over: Partial<BatchInput> = {}): BatchInput => ({
  deviceId: 'dev',
  seq: 4,
  learn: noLearnChanges(),
  typing: { kanaStats: {}, counters: noCounters() },
  settings: null,
  results: [],
  ...over,
});

describe('buildBatch', () => {
  it('returns null when there is nothing to send', () => {
    expect(buildBatch(input(), 1_000_000)).toBeNull();
  });

  it('sends the counters of both modes added together', () => {
    const batch = buildBatch(
      input({
        learn: {
          learn: emptyLearnState(),
          counters: { ...noCounters(), started: { typing: 0, learn: 2 } },
        },
        typing: {
          kanaStats: {},
          counters: {
            ...noCounters(),
            started: { typing: 1, learn: 0 },
            finished: { typing: 1, learn: 0 },
          },
        },
      }),
      1_000_000,
    );
    expect(batch?.request.delta.counters).toEqual({
      started: { typing: 1, learn: 2 },
      finished: { typing: 1, learn: 0 },
    });
    expect(batch?.rest.counters).toEqual(noCounters());
  });

  it('carries the settings alone', () => {
    const batch = buildBatch(input({ settings: settingsAt(9) }), 1_000_000);
    expect(batch?.request.delta.settings?.updatedAt).toBe(9);
    expect(batch?.request.seq).toBe(4);
  });

  it('takes at most 50 results', () => {
    const results = Array.from({ length: 70 }, (_, i) => result(`r${String(i)}`, i));
    const batch = buildBatch(input({ results }), 10_000_000);
    expect(batch?.request.results).toHaveLength(50);
    expect(batch?.resultIds).toHaveLength(50);
  });

  it('drops results from the end until the body fits', () => {
    const results = Array.from({ length: 20 }, (_, i) => result(`r${String(i)}`, i));
    const one = buildBatch(input({ results: results.slice(0, 1) }), 10_000_000);
    const limit = bodyBytes(JSON.stringify(one?.request)) + 100;
    const batch = buildBatch(input({ results }), limit);
    expect(batch?.request.results.length).toBeGreaterThanOrEqual(1);
    expect(batch?.request.results.length).toBeLessThan(20);
    expect(bodyBytes(JSON.stringify(batch?.request))).toBeLessThanOrEqual(limit);
    expect(batch?.resultIds).toEqual(batch?.request.results.map((r) => r.id));
  });

  it('returns null when the delta alone does not fit', () => {
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
