import { describe, it, expect } from 'vitest';
import type { TestResult } from '@nekotype/shared/types';
import { METRICS, metricAxis } from './metrics';

const base: TestResult = {
  id: 'a',
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
  assisted: 2,
  kpm: 100.4,
  kanaAccuracy: 0.955,
  celebratedPersonalBest: false,
  contentVersion: 'c',
  appVersion: 'a',
};

describe('METRICS', () => {
  it('reads and formats each metric', () => {
    expect(METRICS.kpm.value(base)).toBe(100);
    expect(METRICS.accuracy.format(METRICS.accuracy.value(base))).toBe('96%');
    expect(METRICS.rejected.format(METRICS.rejected.value(base))).toBe('4%');
    expect(METRICS.hints.value(base)).toBe(2);
    expect(METRICS.kpm.lowerIsBetter).toBe(false);
    expect(METRICS.rejected.lowerIsBetter).toBe(true);
    expect(METRICS.hints.lowerIsBetter).toBe(true);
  });

  it('counts no rejected keys without keystrokes', () => {
    expect(METRICS.rejected.value({ ...base, keystrokes: 0, rejectedKeystrokes: 0 })).toBe(0);
  });
});

describe('metricAxis', () => {
  it('accuracy 97–100 gives 90…100', () => {
    expect(metricAxis('accuracy', [97, 100]).domain).toEqual([90, 100]);
  });
  it('accuracy 82 gives 80…100', () => {
    expect(metricAxis('accuracy', [82, 99]).domain).toEqual([80, 100]);
  });
  it('accuracy without values gives 90…100', () => {
    expect(metricAxis('accuracy', []).domain).toEqual([90, 100]);
  });
  it('no rejected keys gives 0…5', () => {
    expect(metricAxis('rejected', [0, 0]).domain).toEqual([0, 5]);
    expect(metricAxis('rejected', [12]).domain).toEqual([0, 15]);
  });
  it('no hints gives 0…3', () => {
    expect(metricAxis('hints', [0]).domain).toEqual([0, 3]);
    expect(metricAxis('hints', [0, 7]).domain).toEqual([0, 7]);
  });
  it('ticks stay inside the domain, at most four intervals', () => {
    const axis = metricAxis('accuracy', [82]);
    expect(axis.ticks[0]).toBe(80);
    expect(axis.ticks.at(-1)).toBe(100);
    expect(axis.ticks.length).toBeLessThanOrEqual(5);
  });
  it('kpm keeps the kpm axis', () => {
    expect(metricAxis('kpm', [100, 110]).domain[0]).toBe(100);
  });
});
