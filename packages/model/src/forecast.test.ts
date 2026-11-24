import type { LearnKanaKey, Rng } from '@nekotype/shared/types';
import { describe, expect, it } from 'vitest';
import {
  FORECAST_MAX_SESSIONS,
  HORIZON_DEFAULT_MS,
  SITTING_DEFAULT_MS,
  TASK_DEFAULT_MS,
} from './constants';
import { foldLog } from './fold';
import type { ItemState, ModelState } from './fold';
import { forecastRow, habitsOf, nextRow, outlineSession } from './forecast';
import { trackItems } from './items';
import { intro } from './testing/events';

function seeded(seed: number): Rng {
  let s = seed >>> 0;
  return {
    next() {
      s = (s + 0x6d2b79f5) >>> 0;
      let t = s;
      t = Math.imul(t ^ (t >>> 15), t | 1);
      t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
      return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
    },
  };
}

const EMPTY = foldLog([], { targetMs: 1500, stats: false }).state;

function withLearner(over: Partial<ModelState['learner']>): ModelState {
  return { ...EMPTY, learner: { ...EMPTY.learner, ...over } };
}

function learned(lastAt: number, stability: number): ItemState {
  return {
    phase: 'learned',
    memory: { stability, difficulty: 5 },
    lastAt,
    lastDay: 0,
    streak: 5,
    lastTask: 0,
  };
}

/** Every hiragana learned for good: the planner has nothing to offer on the hiragana track. */
function allHiraganaLearned(): ModelState {
  const items = new Map<LearnKanaKey, ItemState>();
  for (const item of trackItems('hiragana')) items.set(item.key, learned(0, 36_500));
  return { ...EMPTY, items };
}

const ctx = (now = 0, seed = 1) => ({ now, track: 'hiragana' as const, rng: seeded(seed) });

describe('habitsOf', () => {
  it('has defaults for an empty log', () => {
    expect(habitsOf(EMPTY)).toEqual({
      sittingMs: SITTING_DEFAULT_MS,
      gapMs: HORIZON_DEFAULT_MS,
      taskMs: TASK_DEFAULT_MS,
      shares: null,
    });
  });

  it('takes medians, and the sitting adds one task interval', () => {
    const habits = habitsOf(
      withLearner({
        sittings: [100_000, 400_000, 200_000],
        taskMs: Array.from({ length: 25 }, () => 3_000),
        gaps: [10_000_000, 50_000_000, 20_000_000],
      }),
    );
    expect(habits).toMatchObject({ sittingMs: 203_000, gapMs: 20_000_000, taskMs: 3_000 });
  });

  it('keeps the default task time below OUTCOMES_MIN intervals, but still adds the median', () => {
    const habits = habitsOf(withLearner({ sittings: [100_000], taskMs: [2_000] }));
    expect(habits.taskMs).toBe(TASK_DEFAULT_MS);
    expect(habits.sittingMs).toBe(102_000);
  });

  it('adds the default task time to a sitting when no interval is known', () => {
    expect(habitsOf(withLearner({ sittings: [100_000] })).sittingMs).toBe(
      100_000 + TASK_DEFAULT_MS,
    );
  });

  it('gives shares from 20 learning outcomes, and the learning share for reviews until 20 of them', () => {
    const learning = [
      ...Array.from({ length: 15 }, () => true),
      ...Array.from({ length: 5 }, () => false),
    ];
    const only = habitsOf(withLearner({ outcomes: { learning, review: [true] } }));
    expect(only.shares).toEqual({ learning: 0.75, review: 0.75 });
    const review = Array.from({ length: 20 }, (_, i) => i % 2 === 0);
    const both = habitsOf(withLearner({ outcomes: { learning, review } }));
    expect(both.shares).toEqual({ learning: 0.75, review: 0.5 });
    const few = habitsOf(
      withLearner({ outcomes: { learning: learning.slice(0, 19), review: [] } }),
    );
    expect(few.shares).toBeNull();
  });
});

describe('nextRow', () => {
  it('is the first row with a kana not introduced', () => {
    expect(nextRow(EMPTY, 'hiragana')).toBe('hiragana:vowels');
    const first = trackItems('hiragana')[0];
    const state = foldLog([intro(first?.key ?? 'hiragana:あ')], {
      targetMs: 1500,
      stats: false,
    }).state;
    // The row of あ is complete only when all five are in.
    expect(nextRow(state, 'hiragana')).toBe('hiragana:vowels');
  });

  it('moves on when a row is complete, and is null when every kana is introduced', () => {
    const rowA = trackItems('hiragana').filter((item) => item.row === 'hiragana:vowels');
    const events = rowA.map((item, i) => intro(item.key, { n: i + 1, at: i }));
    const state = foldLog(events, { targetMs: 1500, stats: false }).state;
    expect(nextRow(state, 'hiragana')).not.toBe('hiragana:vowels');
    expect(nextRow(allHiraganaLearned(), 'hiragana')).toBeNull();
    expect(nextRow(allHiraganaLearned(), 'katakana')).toBe('katakana:vowels');
  });
});

describe('forecastRow', () => {
  const habits = habitsOf(EMPTY);
  const forecast = (seed: number, history: { forecast: number; actual: number }[] = []) =>
    forecastRow(EMPTY, 'hiragana:vowels', { ...ctx(0, seed), habits, history });

  it('orders low, median and high, and is the same for the same seed', () => {
    const f = forecast(1);
    expect(f.low).toBeLessThanOrEqual(f.median);
    expect(f.median).toBeLessThanOrEqual(f.high);
    expect(f.raw).toBe(f.median);
    expect(f.row).toBe('hiragana:vowels');
    expect(forecast(1)).toEqual(f);
    expect(f.median).toBeGreaterThan(0);
  });

  it('does not change the state it plays', () => {
    const before = JSON.stringify([...EMPTY.items]);
    forecast(2);
    expect(JSON.stringify([...EMPTY.items])).toBe(before);
  });

  it('leaves the forecast as it is with fewer than 3 settled forecasts', () => {
    const f = forecast(3, [
      { forecast: 2, actual: 8 },
      { forecast: 2, actual: 8 },
    ]);
    expect(f).toEqual(forecast(3));
  });

  it('multiplies by the median ratio of the last settled forecasts', () => {
    const plain = forecast(4);
    const history = [
      { forecast: 2, actual: 4 },
      { forecast: 3, actual: 6 },
      { forecast: 4, actual: 8 },
    ];
    const f = forecast(4, history);
    expect(f.raw).toBe(plain.raw);
    expect(f.median).toBe(Math.max(1, Math.round(plain.median * 2)));
    expect(f.low).toBe(Math.max(1, Math.round(plain.low * 2)));
    expect(f.high).toBe(Math.max(1, Math.round(plain.high * 2)));
  });

  it('uses only the last 10 settled forecasts', () => {
    const history = [
      ...Array.from({ length: 10 }, () => ({ forecast: 1, actual: 1 })),
      ...Array.from({ length: 5 }, () => ({ forecast: 1, actual: 3 })),
    ];
    // The last 10: five of ratio 1 and five of ratio 3; the element at index 5 is 3.
    expect(forecast(5, history).median).toBe(Math.round(forecast(5).median * 3));
  });

  it('is FORECAST_MAX_SESSIONS + 1 when the play never reaches the row', () => {
    // Nothing introduces a katakana from the hiragana track while hiragana are still to come.
    const f = forecastRow(EMPTY, 'katakana:vowels', { ...ctx(0, 6), habits, history: [] });
    expect(f).toMatchObject({
      low: FORECAST_MAX_SESSIONS + 1,
      median: FORECAST_MAX_SESSIONS + 1,
      high: FORECAST_MAX_SESSIONS + 1,
    });
  });

  it('stops at the sitting guard when there is nothing to play', () => {
    const f = forecastRow(allHiraganaLearned(), 'katakana:vowels', {
      ...ctx(0, 7),
      habits: habitsOf(allHiraganaLearned()),
      history: [],
    });
    expect(f.median).toBe(FORECAST_MAX_SESSIONS + 1);
  });

  it('plays with the shares of the learner when it has them', () => {
    const shares = { learning: 1, review: 1 };
    const sure = forecastRow(EMPTY, 'hiragana:vowels', {
      ...ctx(0, 8),
      habits: { ...habits, shares },
      history: [],
    });
    const lost = forecastRow(EMPTY, 'hiragana:vowels', {
      ...ctx(0, 8),
      habits: { ...habits, shares: { learning: 0, review: 0 } },
      history: [],
    });
    expect(sure.median).toBeLessThanOrEqual(lost.median);
  });

  it('starts a new sitting when the last task is over an hour old, and carries on one that is not', () => {
    const recent = withLearner({ lastTaskAt: 1_000, sittingStart: 0 });
    const old = withLearner({ lastTaskAt: 0, sittingStart: 0 });
    for (const [state, now] of [
      [recent, 2_000],
      [old, 10_000_000],
    ] as const) {
      const f = forecastRow(state, 'hiragana:vowels', {
        now,
        track: 'hiragana',
        rng: seeded(9),
        habits,
        history: [],
      });
      expect(f.median).toBeGreaterThan(0);
    }
  });

  it('refuses a row that is not in the tables', () => {
    expect(() => forecastRow(EMPTY, 'hiragana:zz', { ...ctx(), habits, history: [] })).toThrow();
  });

  it('plays in the zone of a device that has one', () => {
    const state = withLearner({ tz: { phone: 540 } });
    expect(
      forecastRow(state, 'hiragana:vowels', { ...ctx(0, 10), habits, history: [] }).median,
    ).toBeGreaterThan(0);
  });
});

describe('outlineSession', () => {
  it('counts the tasks of the next session of an empty log (a seeded play: kana graduate within it)', () => {
    expect(outlineSession(EMPTY, ctx())).toEqual({ reviews: 2, learning: 22, introductions: 6 });
  });

  it('puts the reviews that are due first', () => {
    const items = new Map<LearnKanaKey, ItemState>([
      ['hiragana:あ', learned(0, 0.1)],
      ['hiragana:い', learned(0, 0.1)],
    ]);
    const outline = outlineSession({ ...EMPTY, items }, ctx(10 * 86_400_000));
    expect(outline.reviews).toBeGreaterThanOrEqual(2);
    expect(outline.reviews + outline.learning + outline.introductions).toBeLessThanOrEqual(30);
  });

  it('is empty when nothing is left', () => {
    expect(outlineSession(allHiraganaLearned(), ctx())).toEqual({
      reviews: 0,
      learning: 0,
      introductions: 0,
    });
  });
});
