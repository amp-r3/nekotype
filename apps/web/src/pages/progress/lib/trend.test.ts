import { describe, it, expect } from 'vitest';
import { dayStart, localDay } from '@/entities/learn';
import { axisOf, timeAxis } from './trend';

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
