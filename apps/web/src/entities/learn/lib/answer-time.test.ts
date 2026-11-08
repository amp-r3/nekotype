import { describe, it, expect } from 'vitest';
import {
  ANSWER_TIME_CAP_MS,
  DEFAULT_K_MS,
  intervalsOf,
  median,
  recallAnswerTime,
  typingK,
} from './answer-time';
import type { Keystroke } from './answer-time';

const keys = (...times: number[]): Keystroke[] => times.map((t) => ({ t, accepted: true }));

describe('median', () => {
  it('takes the middle value, or the mean of the two middle ones', () => {
    expect(median([3, 1, 2])).toBe(2);
    expect(median([4, 1, 3, 2])).toBe(2.5);
    expect(median([])).toBe(0);
  });
});

describe('recallAnswerTime (spec examples, K = 200)', () => {
  it('あ typed at 800 ms is 800', () => {
    expect(recallAnswerTime(keys(800), 200)).toBe(800);
  });
  it('し typed at 800, 1000 and 1200 ms is 800', () => {
    expect(recallAnswerTime(keys(800, 1000, 1200), 200)).toBe(800);
  });
  it('き typed at 300 and 1100 ms is 900', () => {
    expect(recallAnswerTime(keys(300, 1100), 200)).toBe(900);
  });
  it('never drops below the time of the first key', () => {
    expect(recallAnswerTime(keys(500, 600, 700), 200)).toBe(500);
  });
  it('is capped', () => {
    expect(recallAnswerTime(keys(12_000), 200)).toBe(ANSWER_TIME_CAP_MS);
  });
  it('counts accepted keys only', () => {
    const typed: Keystroke[] = [
      { t: 400, accepted: false },
      { t: 900, accepted: true },
      { t: 1000, accepted: false },
      { t: 1500, accepted: true },
    ];
    expect(recallAnswerTime(typed, 200)).toBe(1300);
  });
});

describe('intervalsOf', () => {
  it('measures the time between consecutive accepted keys', () => {
    expect(intervalsOf(keys(800, 1000, 1250))).toEqual([200, 250]);
  });
  it('leaves out an interval across a rejected key or Esc', () => {
    const typed: Keystroke[] = [
      { t: 100, accepted: true },
      { t: 200, accepted: false },
      { t: 400, accepted: true },
      { t: 550, accepted: true },
      { t: 600, accepted: false },
      { t: 900, accepted: true },
    ];
    expect(intervalsOf(typed)).toEqual([150]);
  });
  it('has none for a single key', () => {
    expect(intervalsOf(keys(500))).toEqual([]);
  });
});

describe('typingK', () => {
  it('is 200 ms below 20 intervals', () => {
    expect(typingK(Array.from({ length: 19 }, () => 100))).toBe(DEFAULT_K_MS);
  });
  it('is the median of the intervals from the 20th on', () => {
    expect(typingK(Array.from({ length: 20 }, () => 100))).toBe(100);
  });
  it('uses the last 50 intervals only', () => {
    const intervals = [
      ...Array.from({ length: 30 }, () => 500),
      ...Array.from({ length: 50 }, () => 120),
    ];
    expect(typingK(intervals)).toBe(120);
  });
  it('changes the answer time when the 20th interval is recorded', () => {
    const typed = keys(800, 1000, 1200);
    const before = Array.from({ length: 19 }, () => 100);
    expect(recallAnswerTime(typed, typingK(before))).toBe(800);
    expect(recallAnswerTime(typed, typingK([...before, 100]))).toBe(1000);
  });
});
