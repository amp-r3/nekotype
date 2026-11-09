import { describe, it, expect } from 'vitest';
import { medianAxis, medianSeries } from './median-series';

describe('medianSeries', () => {
  it('runs from the first day with answers to today, with null for a day without', () => {
    const series = medianSeries(
      [
        { day: 96, ms: 1150 },
        { day: 98, ms: 1250 },
        { day: 100, ms: 1050 },
      ],
      100,
    );
    expect(series.days).toEqual([96, 97, 98, 99, 100]);
    expect(series.values).toEqual([1150, null, 1250, null, 1050]);
  });

  it('keeps the last 30 days only', () => {
    const series = medianSeries(
      [
        { day: 10, ms: 900 },
        { day: 100, ms: 1000 },
      ],
      100,
    );
    expect(series.days).toHaveLength(30);
    expect(series.days[0]).toBe(71);
    expect(series.days[29]).toBe(100);
    // The old answer is out of the window.
    expect(series.values.filter((value) => value !== null)).toEqual([1000]);
  });

  it('is today alone without answers, and a trailing gap shows after the last answer', () => {
    expect(medianSeries([], 50)).toEqual({ days: [50], values: [null] });
    expect(medianSeries([{ day: 48, ms: 1100 }], 50).values).toEqual([1100, null, null]);
  });
});

describe('medianAxis', () => {
  it('steps by 500 ms around the values and the target, the target off the edge', () => {
    expect(medianAxis([1100, 1400, null], 1500)).toEqual({
      domain: [1000, 2000],
      ticks: [1000, 1500, 2000],
    });
  });

  it('reaches up to a slow value and down to a fast one', () => {
    expect(medianAxis([700, 2600], 1500).domain).toEqual([500, 3000]);
  });

  it('covers the target alone', () => {
    expect(medianAxis([null], 1500).domain).toEqual([1500, 2000]);
  });
});
