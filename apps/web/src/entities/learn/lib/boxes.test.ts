import { describe, it, expect, beforeAll } from 'vitest';
import type { RecallAnswer } from '@nekotype/shared/types';
import { BOX_DAYS, dueAtFor, isDue, isMastered, nextBox, reviewEntry, settleEntry } from './boxes';
import { dayStart, localDay } from './day';

beforeAll(() => {
  process.env['TZ'] = 'America/New_York';
});

const at = (y: number, m: number, d: number, h = 0): number => new Date(y, m - 1, d, h).getTime();
const answers = (ms: number, ok = true): RecallAnswer[] =>
  Array.from({ length: 10 }, (_, i) => ({ at: i, ms, ok }));

describe('due dates', () => {
  it('are the start of the local day after the interval, not the time of day', () => {
    const now = at(2026, 5, 10, 17);
    expect(dueAtFor(1, now)).toBe(at(2026, 5, 11));
    expect(dueAtFor(2, now)).toBe(at(2026, 5, 13));
    expect(dueAtFor(5, now)).toBe(at(2026, 6, 9));
    expect(dueAtFor(0, now)).toBe(0);
  });
  it('stay on midnight across a daylight-saving change', () => {
    // 2026-03-08: the clocks go forward in New York.
    expect(dueAtFor(3, at(2026, 3, 5, 20))).toBe(at(2026, 3, 12));
    expect(dueAtFor(1, at(2026, 3, 7, 23))).toBe(at(2026, 3, 8));
    expect(dueAtFor(1, at(2026, 3, 8, 3))).toBe(at(2026, 3, 9));
    expect(BOX_DAYS[4]).toBe(14);
  });
  it('make a kana due once the date has come, never in box 0', () => {
    const entry = { box: 1, dueAt: at(2026, 5, 11), updatedAt: 1 } as const;
    expect(isDue(entry, at(2026, 5, 10, 23))).toBe(false);
    expect(isDue(entry, at(2026, 5, 11))).toBe(true);
    expect(isDue({ box: 0, dueAt: 0, updatedAt: 1 }, at(2026, 5, 11))).toBe(false);
    expect(isDue(undefined, 1)).toBe(false);
  });
});

describe('boxes', () => {
  const now = at(2026, 5, 10, 12);
  it('enter box 1 at first confidence, and not before', () => {
    const entry = { box: 0, dueAt: 0, updatedAt: 1 } as const;
    expect(settleEntry(entry, answers(1500), 1500, now)).toEqual({
      box: 1,
      dueAt: at(2026, 5, 11),
      updatedAt: now,
    });
    expect(settleEntry(entry, answers(1501), 1500, now)).toBe(entry);
    expect(settleEntry(entry, answers(1000).slice(1), 1500, now)).toBe(entry);
  });
  it('are not moved by learning answers once at box 1 or higher', () => {
    const entry = { box: 3, dueAt: 5, updatedAt: 1 } as const;
    expect(settleEntry(entry, answers(500), 1500, now)).toBe(entry);
  });
  it('go up by one on a correct review and stop at 5', () => {
    const one = { box: 1, dueAt: 5, updatedAt: 1 } as const;
    const two = reviewEntry(one, true, now);
    expect(two).toEqual({ box: 2, dueAt: dayStart(localDay(now) + 3), updatedAt: now });
    expect(reviewEntry({ ...one, box: 5 }, true, now).box).toBe(5);
    expect(nextBox(4)).toBe(5);
  });
  it('go back to box 1 on an error in a review', () => {
    const entry = { box: 4, dueAt: 5, updatedAt: 1 } as const;
    expect(reviewEntry(entry, false, now)).toEqual({
      box: 1,
      dueAt: at(2026, 5, 11),
      updatedAt: now,
    });
  });
  it('leave box 0 alone in a review', () => {
    const entry = { box: 0, dueAt: 0, updatedAt: 1 } as const;
    expect(reviewEntry(entry, true, now)).toBe(entry);
  });
  it('make a cell mastered only from box 4 and confident', () => {
    const entry = { box: 4, dueAt: 5, updatedAt: 1 } as const;
    expect(isMastered(entry, answers(1000), 1500)).toBe(true);
    expect(isMastered(entry, answers(2000), 1500)).toBe(false);
    expect(isMastered({ ...entry, box: 3 }, answers(1000), 1500)).toBe(false);
    expect(isMastered(undefined, answers(1000), 1500)).toBe(false);
  });
});
