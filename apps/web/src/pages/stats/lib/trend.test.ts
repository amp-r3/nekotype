import { describe, it, expect } from 'vitest';
import type { TestResult, TypingRecords } from '@nekotype/shared/types';
import { personalBestKey } from '@nekotype/shared/runtime';
import { dayStart, localDay } from '@/entities/learn';
import { axisOf, fewAxis, kpmAxis, quantile, rolling, timeAxis, trendPoints } from './trend';

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

describe('kpmAxis', () => {
  it('rounds the range out to tens and picks the step', () => {
    expect(kpmAxis([61, 101])).toEqual({ domain: [60, 120], ticks: [60, 80, 100, 120] });
  });

  it('is at least 20 wide for one value or equal values', () => {
    expect(kpmAxis([100])).toEqual({ domain: [90, 110], ticks: [90, 95, 100, 105, 110] });
    expect(kpmAxis([100, 100])).toEqual(kpmAxis([100]));
  });

  it('never goes below 0', () => {
    const axis = kpmAxis([3, 8]);
    expect(axis.domain[0]).toBe(0);
    expect(kpmAxis([]).domain[0]).toBe(0);
  });

  it('keeps at most four intervals for a wide range', () => {
    const axis = kpmAxis([40, 300]);
    expect(axis.ticks.length).toBeLessThanOrEqual(5);
    expect(axis.ticks).toEqual([0, 100, 200, 300, 400]);
    expect(axis.domain[0]).toBeLessThanOrEqual(40);
    expect(axis.domain[1]).toBeGreaterThanOrEqual(300);
  });
});

describe('axisOf', () => {
  it('snaps the domain out to the smallest fitting step', () => {
    expect(axisOf(65, 100, [1, 5, 10])).toEqual({
      domain: [60, 100],
      ticks: [60, 70, 80, 90, 100],
    });
    expect(axisOf(0, 4, [1, 2, 5])).toEqual({ domain: [0, 4], ticks: [0, 1, 2, 3, 4] });
    expect(axisOf(0, 5, [1, 2, 5])).toEqual({ domain: [0, 6], ticks: [0, 2, 4, 6] });
  });
  it('takes the largest step when none fits', () => {
    expect(axisOf(0, 100, [1, 2, 5]).domain).toEqual([0, 100]);
    expect(axisOf(0, 100, [1, 2, 5]).ticks[1]).toBe(5);
  });
  it('kpm 10–600 has four intervals', () => {
    expect(kpmAxis([10, 600])).toEqual({ domain: [0, 800], ticks: [0, 200, 400, 600, 800] });
  });
});

describe('timeAxis', () => {
  const today = localDay(Date.UTC(2026, 5, 15, 12));
  const format = (ms: number): string => String(localDay(ms) - today);

  it('covers 7 days with a tick a day, ending today', () => {
    const axis = timeAxis('7', 0, today, false, format);
    expect(axis.days).toBe(7);
    expect(axis.domain).toEqual([dayStart(today - 6), dayStart(today + 1)]);
    expect(axis.ticks.map((tick) => tick.label)).toEqual(['-6', '-5', '-4', '-3', '-2', '-1', '0']);
  });

  it('ticks sit in the middle of a day', () => {
    const [first] = timeAxis('7', 0, today, false, format).ticks;
    expect(first?.x).toBe(dayStart(today - 6) + 12 * 3600_000);
  });

  it('steps by 7 days over 30 days, counted back from today', () => {
    const axis = timeAxis('30', 0, today, false, format);
    expect(axis.ticks.map((tick) => tick.label)).toEqual(['-28', '-21', '-14', '-7', '0']);
  });

  it('doubles the step when narrow', () => {
    const axis = timeAxis('7', 0, today, true, format);
    expect(axis.ticks.map((tick) => tick.label)).toEqual(['-6', '-4', '-2', '0']);
  });

  it('"all" starts at the first result and is at least 14 days', () => {
    const short = timeAxis('all', dayStart(today - 2), today, false, format);
    expect(short.days).toBe(14);
    expect(short.ticks.map((tick) => tick.label)).toEqual([
      '-12',
      '-10',
      '-8',
      '-6',
      '-4',
      '-2',
      '0',
    ]);
    const long = timeAxis('all', dayStart(today - 99), today, false, format);
    expect(long.days).toBe(100);
    expect(long.domain[0]).toBe(dayStart(today - 99));
    expect(long.ticks[long.ticks.length - 1]?.label).toBe('0');
    // ceil(100 / 35) × 7 = 21 days between ticks.
    expect(long.ticks.map((tick) => tick.label).slice(-2)).toEqual(['-21', '0']);
  });
});

describe('trendPoints', () => {
  it('marks the current best, a repeat, and a plain test', () => {
    const best = result('a', { kpm: 90.4, endedAt: 1000 });
    const repeat = result('b', { repeated: true, endedAt: 2000 });
    const plain = result('c', { endedAt: 3000 });
    const records: TypingRecords = {
      [personalBestKey(best)]: { best: { resultId: 'a', kpm: 90.4 }, recent: [] },
    };
    const points = trendPoints(
      [best, repeat, plain],
      records,
      (r) => Math.round(r.kpm),
      (r, mark) => [r.id, String(mark)],
    );
    expect(points.map((point) => point.mark)).toEqual(['best', 'hollow', null]);
    expect(points[0]).toMatchObject({ x: 1000, y: 90 });
    expect(points[0]?.tip()).toEqual(['a', 'best']);
  });
});

describe('quantile', () => {
  it('handles 1, 2, 5 and 10 values by linear interpolation', () => {
    expect(quantile([3, 1, 2], 0.5)).toBe(2);
    expect(quantile([4, 1, 2, 3], 0.5)).toBe(2.5);
    expect(quantile([], 0.5)).toBe(0);
    expect(quantile([7], 0.25)).toBe(7);
    expect(quantile([10, 20], 0.5)).toBe(15);
    expect(quantile([10, 20], 0.25)).toBe(12.5);
    expect(quantile([5, 1, 3, 2, 4], 0.5)).toBe(3);
    expect(quantile([1, 2, 3, 4, 5], 0.25)).toBe(2);
    expect(quantile([1, 2, 3, 4, 5], 0.75)).toBe(4);
    const ten = [1, 2, 3, 4, 5, 6, 7, 8, 9, 10];
    expect(quantile(ten, 0.5)).toBe(5.5);
    expect(quantile(ten, 0.25)).toBe(3.25);
    expect(quantile(ten, 0.75)).toBe(7.75);
  });

  it('is 0 for no values', () => {
    expect(quantile([], 0.5)).toBe(0);
  });
});

describe('rolling', () => {
  const list = (count: number): TestResult[] =>
    Array.from({ length: count }, (_, i) =>
      result(`r${i}`, { endedAt: (i + 1) * 1000, kpm: i + 1 }),
    );
  const kpm = (r: TestResult): number => r.kpm;

  it('is null for the first three results and starts at the fourth', () => {
    const series = rolling(list(6), kpm);
    expect(series.slice(0, 3)).toEqual([null, null, null]);
    expect(series[3]).toEqual({ x: 4000, y: 2.5, lo: 1.75, hi: 3.25 });
  });

  it('five results draw a line of two points', () => {
    const series = rolling(list(5), kpm);
    expect(series.filter((point) => point !== null)).toHaveLength(2);
  });

  it('grows the window from 4 to 10, then slides', () => {
    const series = rolling(list(12), kpm);
    // Window of 10 at index 9: 1..10; at index 11: 3..12.
    expect(series[9]).toMatchObject({ y: 5.5, lo: 3.25, hi: 7.75 });
    expect(series[11]).toMatchObject({ y: 7.5, lo: 5.25, hi: 9.75 });
  });

  it('is empty for an empty selection', () => {
    expect(rolling([], kpm)).toEqual([]);
  });
});

describe('fewAxis', () => {
  it('has five slots and one tick per result at its index', () => {
    const axis = fewAxis(
      [result('a', { endedAt: 1 }), result('b', { endedAt: 2 })],
      (ms) => `d${ms}`,
    );
    expect(axis.domain).toEqual([-0.5, 4.5]);
    expect(axis.ticks).toEqual([
      { x: 0, label: 'd1' },
      { x: 1, label: 'd2' },
    ]);
  });
});
