import { describe, it, expect } from 'vitest';
import type { TestResult } from '@nekotype/shared/types';
import { METRICS, metricAxis } from './metrics';
import type { Metric } from './metrics';

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
  it('accuracy ticks', () => {
    expect(metricAxis('accuracy', [97]).ticks).toEqual([90, 95, 100]);
    expect(metricAxis('accuracy', [82]).ticks).toEqual([80, 85, 90, 95, 100]);
    expect(metricAxis('accuracy', [65]).ticks).toEqual([60, 70, 80, 90, 100]);
  });
  it('rejected keys end on a tick', () => {
    expect(metricAxis('rejected', [0, 0]).ticks).toEqual([0, 2, 4, 6]);
    expect(metricAxis('rejected', [12]).ticks).toEqual([0, 5, 10, 15]);
    expect(metricAxis('rejected', [35]).ticks).toEqual([0, 10, 20, 30, 40]);
  });
  it('hints end on a tick', () => {
    expect(metricAxis('hints', [0]).ticks).toEqual([0, 1, 2, 3]);
    expect(metricAxis('hints', [5]).ticks).toEqual([0, 2, 4, 6]);
    expect(metricAxis('hints', [9]).ticks).toEqual([0, 5, 10]);
  });
  it('kpm 10–600 has at most five ticks', () => {
    expect(metricAxis('kpm', [10, 600]).ticks.length).toBeLessThanOrEqual(5);
  });
  it('every metric: the domain ends on ticks, evenly spaced, values inside', () => {
    const cases: [Metric, number, number, number][] = [
      ['accuracy', 0, 100, 1],
      ['rejected', 0, 100, 1],
      ['hints', 0, 40, 1],
      ['kpm', 0, 700, 7],
    ];
    for (const [metric, from, to, stride] of cases) {
      for (let low = from; low <= to; low += stride) {
        for (const high of [low, Math.min(to, low + 3), to]) {
          const axis = metricAxis(metric, [low, high]);
          const { domain, ticks } = axis;
          const where = `${metric} ${low}–${high}`;
          expect(ticks[0], where).toBe(domain[0]);
          expect(ticks.at(-1), where).toBe(domain[1]);
          expect(ticks.length, where).toBeLessThanOrEqual(5);
          const gap = (ticks[1] ?? 0) - (ticks[0] ?? 0);
          ticks.forEach((tick, i) => {
            expect(tick - (ticks[0] ?? 0), where).toBe(gap * i);
          });
          expect(low, where).toBeGreaterThanOrEqual(domain[0]);
          expect(high, where).toBeLessThanOrEqual(domain[1]);
          if (metric === 'accuracy') expect(domain[1], where).toBe(100);
          if (metric === 'rejected' || metric === 'hints') expect(domain[0], where).toBe(0);
        }
      }
    }
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
