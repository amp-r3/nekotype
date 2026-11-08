import { describe, it, expect, beforeAll } from 'vitest';
import { dayStart, localDay } from './day';

beforeAll(() => {
  process.env['TZ'] = 'America/New_York';
});

const at = (y: number, m: number, d: number, h = 0, min = 0): number =>
  new Date(y, m - 1, d, h, min).getTime();

describe('local day', () => {
  it('changes at local midnight', () => {
    expect(localDay(at(2026, 3, 1, 23, 59))).toBe(localDay(at(2026, 3, 1, 0, 0)));
    expect(localDay(at(2026, 3, 2, 0, 0))).toBe(localDay(at(2026, 3, 1, 0, 0)) + 1);
  });
  it('counts days from 1970-01-01', () => {
    expect(localDay(at(1970, 1, 2, 12))).toBe(1);
  });
  it('gives the start of the day, also on a daylight-saving day', () => {
    const day = localDay(at(2026, 3, 8, 12)); // the clocks go forward on this day in New York
    expect(dayStart(day)).toBe(at(2026, 3, 8));
    expect(dayStart(day + 1)).toBe(at(2026, 3, 9));
    expect(dayStart(day + 1) - dayStart(day)).toBe(23 * 3_600_000);
  });
});
