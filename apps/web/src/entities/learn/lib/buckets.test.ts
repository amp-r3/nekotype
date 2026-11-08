import { describe, it, expect } from 'vitest';
import { addRecallTime, dailyMedian, dailyMedians } from './buckets';

describe('daily median', () => {
  it('is the midpoint of the bucket of the ⌈n / 2⌉-th shortest time', () => {
    let days = {};
    for (const ms of [850, 1210, 990]) days = addRecallTime(days, 7, ms);
    // sorted: 850 (bucket 8), 990 (9), 1210 (12); the 2nd is in bucket 9.
    expect(dailyMedian(days, 7)).toBe(950);
  });
  it('takes the lower middle of an even count', () => {
    let days = {};
    for (const ms of [100, 200, 300, 400]) days = addRecallTime(days, 7, ms);
    expect(dailyMedian(days, 7)).toBe(250);
  });
  it('puts a capped time in bucket 100', () => {
    expect(dailyMedian(addRecallTime({}, 1, 10_000), 1)).toBe(10_050);
  });
  it('is null for a day without answers', () => {
    expect(dailyMedian({}, 1)).toBeNull();
  });
  it('lists the days of a track in order and drops days over 365 days old', () => {
    let hiragana = addRecallTime({}, 1, 500);
    hiragana = addRecallTime(hiragana, 400, 700);
    hiragana = addRecallTime(hiragana, 300, 900);
    expect(dailyMedians({ hiragana, katakana: {} }, 'hiragana')).toEqual([
      { day: 300, ms: 950 },
      { day: 400, ms: 750 },
    ]);
    expect(dailyMedians({ hiragana, katakana: {} }, 'katakana')).toEqual([]);
  });
});
