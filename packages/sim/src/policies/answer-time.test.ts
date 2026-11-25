import { describe, expect, it } from 'vitest';
import { createRng, logNormal } from '../rng';
import { BASE, createThreshold } from './answer-time';
import type { Rule, TimedAnswer } from './answer-time';

const answer = (ms: number, n: number, dev = 'a'): TimedAnswer => ({
  ms,
  dev,
  track: 'hiragana',
  item: 0,
  review: true,
  n,
  p: Number.NaN,
});

/** The share of good over `count` answers of median `median` ms, after a warm-up. */
function goodShare(rule: Rule, median: number, count = 2000): number {
  const rng = createRng(7);
  const t = createThreshold(rule);
  let good = 0;
  for (let n = 1; n <= count; n += 1) {
    const a = answer(Math.round(median * logNormal(rng, 0.3)), n);
    if (n > 200) good += t.judge(a).good;
    t.observe(a);
  }
  return good / (count - 200);
}

const tracker: Rule = {
  ...BASE,
  name: 'tracker p90',
  level: { kind: 'tracker', q: 0.9, step: 0.05, k: 1 },
  by: 'dev',
  cold: { answers: 20, before: 'none' },
};

describe('threshold rules', () => {
  it('judges an answer from the answers before it only', () => {
    const t = createThreshold(BASE);
    for (let n = 1; n <= 30; n += 1) t.observe(answer(1000, n));
    const before = t.judge(answer(5000, 31));
    expect(before.threshold).toBeCloseTo(1200);
    expect(before.good).toBe(0);
  });

  it('uses the cold-start rule until enough answers', () => {
    const t = createThreshold(BASE);
    expect(t.judge(answer(1400, 1)).good).toBe(1);
    expect(t.judge(answer(1600, 1)).good).toBe(0);
    const none = createThreshold({ ...BASE, cold: { answers: 20, before: 'none' } });
    expect(none.judge(answer(9000, 1)).good).toBe(1);
  });

  it('holds the share of good of a quantile whatever the speed', () => {
    for (const median of [700, 1500, 3000]) {
      expect(goodShare(tracker, median)).toBeGreaterThan(0.87);
      expect(goodShare(tracker, median)).toBeLessThan(0.93);
    }
  });

  it('keeps a level per device, and the level of all devices for a new one', () => {
    const t = createThreshold(tracker);
    for (let n = 1; n <= 200; n += 1) t.observe(answer(1000, n, 'desk'));
    expect(t.judge(answer(1000, 201, 'phone')).threshold).toBeCloseTo(1000, -2);
    for (let n = 202; n <= 400; n += 1) t.observe(answer(2000, n, 'phone'));
    expect(t.judge(answer(1000, 401, 'phone')).threshold).toBeGreaterThan(1800);
    expect(t.judge(answer(1000, 402, 'desk')).threshold).toBeLessThan(1100);
  });
});
