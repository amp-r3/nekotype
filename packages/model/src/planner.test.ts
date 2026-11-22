import type { LearnKanaKey, Rng, Track } from '@nekotype/shared/types';
import { describe, expect, it } from 'vitest';
import { DAY_MS, HORIZON_DEFAULT_MS, RECOGNITION_SHARE, STEP_MS, TRACK_LAG } from './constants';
import { createFold } from './fold';
import type { ItemState, ModelState } from './fold';
import { retrievability } from './fsrs';
import { dueFrom, horizonMs, requestedRetention } from './learner';
import { ITEMS, trackItems } from './items';
import { nextTask } from './planner';
import type { PlanContext } from './planner';

const A: LearnKanaKey = 'hiragana:あ';
const I: LearnKanaKey = 'hiragana:い';
const U: LearnKanaKey = 'hiragana:う';
const E: LearnKanaKey = 'hiragana:え';
const O: LearnKanaKey = 'hiragana:お';
const KA: LearnKanaKey = 'hiragana:か';
const GA: LearnKanaKey = 'hiragana:が';
const KI: LearnKanaKey = 'hiragana:き';
const YA: LearnKanaKey = 'hiragana:や';
const KYA: LearnKanaKey = 'hiragana:きゃ';

const NOW = 100 * DAY_MS;

/** The mulberry32 stream of the simulator, so a test is seeded. */
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

/** An rng that returns the same value every time. */
const constant = (value: number): Rng => ({ next: () => value });

const ctx = (over: Partial<PlanContext> = {}): PlanContext => ({
  now: NOW,
  track: 'hiragana',
  previous: null,
  rng: constant(0.99), // never a recognition
  ...over,
});

const item = (over: Partial<ItemState> = {}): ItemState => ({
  phase: 'learned',
  memory: { difficulty: 5, stability: 10 },
  lastAt: NOW,
  lastDay: Math.floor(NOW / DAY_MS),
  streak: 0,
  lastTask: 0,
  ...over,
});

const learning = (over: Partial<ItemState> = {}): ItemState =>
  item({ phase: 'learning', memory: { difficulty: 5, stability: 0.1 }, ...over });

const KEYS = new Map<string, LearnKanaKey>([...ITEMS.keys()].map((key) => [key, key]));

/** A state with the given items; `learner` overrides parts of the learner. */
function stateOf(
  items: Readonly<Record<string, ItemState>>,
  learner: Partial<ModelState['learner']> = {},
): ModelState {
  const base = createFold({ targetMs: 1500, stats: false }).state;
  const map = new Map<LearnKanaKey, ItemState>();
  for (const [name, value] of Object.entries(items)) {
    const key = KEYS.get(name);
    if (key === undefined) throw new Error(`not a kana: ${name}`);
    map.set(key, value);
  }
  return { ...base, items: map, learner: { ...base.learner, ...learner } };
}

/** Every kana learned and far from due. */
function everything(): Record<string, ItemState> {
  return Object.fromEntries([...ITEMS.keys()].map((key) => [key, item({ lastAt: NOW })]));
}

const keyOf = (task: ReturnType<typeof nextTask>): LearnKanaKey | undefined => task?.key;

describe('the choice', () => {
  it('takes a due kana before a ready one, a ready one before an introduction', () => {
    const dueA = item({ lastAt: NOW - 100 * DAY_MS });
    const readyI = learning({ lastAt: NOW - STEP_MS });
    expect(nextTask(stateOf({ [A]: dueA, [I]: readyI }), ctx())).toEqual({
      kind: 'recall',
      key: A,
      review: true,
    });
    expect(nextTask(stateOf({ [I]: readyI }), ctx())).toEqual({
      kind: 'recall',
      key: I,
      review: false,
    });
  });

  it('introduces when no kana is due or ready, and the learning ones wait', () => {
    const items = { [A]: learning({ lastAt: NOW - 1000 }) };
    expect(nextTask(stateOf(items), ctx())).toEqual({ kind: 'introduction', key: I });
  });

  it('starts a session with the first kana of the track', () => {
    expect(nextTask(stateOf({}), ctx())).toEqual({ kind: 'introduction', key: A });
    expect(nextTask(stateOf({}), ctx({ track: 'katakana' }))).toEqual({
      kind: 'introduction',
      key: 'katakana:ア',
    });
  });

  it('shows a learning kana that is not ready when the limit stops introductions', () => {
    const items = Object.fromEntries(
      [A, I, U, E].map((key, i) => [key, learning({ lastAt: NOW - 1000, lastTask: i })]),
    );
    expect(nextTask(stateOf(items), ctx())?.kind).toBe('recall');
    expect(keyOf(nextTask(stateOf(items), ctx()))).toBe(A); // the oldest by `lastTask`
  });

  it('orders ready kana by lastTask, then by track order', () => {
    const ki = learning({ lastAt: NOW - STEP_MS, lastTask: 5 });
    const ka = learning({ lastAt: NOW - STEP_MS, lastTask: 7 });
    expect(keyOf(nextTask(stateOf({ [I]: ki, [A]: ka, [U]: ki }), ctx()))).toBe(I);
    expect(keyOf(nextTask(stateOf({ [U]: ki, [I]: ki }), ctx()))).toBe(I);
  });
});

describe('due kana', () => {
  const stability = 10;

  it('looks ahead 12 hours until a gap is known', () => {
    const state = stateOf({ [A]: item({ lastAt: NOW, memory: { difficulty: 5, stability } }) });
    const from = dueFrom(state, A) ?? Number.NaN;
    expect(horizonMs(state)).toBe(HORIZON_DEFAULT_MS);
    expect(nextTask(state, ctx({ now: from - 1 }))?.kind).toBe('introduction');
    expect(nextTask(state, ctx({ now: from }))).toEqual({ kind: 'recall', key: A, review: true });
  });

  it('looks ahead by the median of the gaps', () => {
    const gaps = [2, 3, 4, 5, 6].map((h) => h * 3_600_000);
    const state = stateOf(
      { [A]: item({ lastAt: NOW, memory: { difficulty: 5, stability } }) },
      { gaps },
    );
    expect(horizonMs(state)).toBe(4 * 3_600_000);
    const from = dueFrom(state, A) ?? Number.NaN;
    const plain = stateOf({ [A]: item({ lastAt: NOW, memory: { difficulty: 5, stability } }) });
    expect(from).toBeGreaterThan(dueFrom(plain, A) ?? Number.NaN);
    expect(nextTask(state, ctx({ now: from - 1 }))?.kind).toBe('introduction');
    expect(nextTask(state, ctx({ now: from }))?.kind).toBe('recall');
  });

  it('takes the lowest predicted recall first, then track order', () => {
    const far = NOW - 200 * DAY_MS;
    const items = {
      [I]: item({ lastAt: far, memory: { difficulty: 5, stability: 10 } }),
      [A]: item({ lastAt: far, memory: { difficulty: 5, stability: 100 } }),
      [U]: item({ lastAt: far + DAY_MS, memory: { difficulty: 5, stability: 10 } }),
    };
    // い has the lowest recall at now + h: the longest elapsed time over a stability of 10.
    expect(keyOf(nextTask(stateOf(items), ctx()))).toBe(I);
    const tied = {
      [U]: item({ lastAt: far }),
      [I]: item({ lastAt: far }),
    };
    expect(keyOf(nextTask(stateOf(tied), ctx()))).toBe(I);
  });

  it('is a recall that counts as a review, never a recognition', () => {
    const state = stateOf({ [A]: item({ lastAt: NOW - 100 * DAY_MS }) });
    for (let i = 0; i < 20; i += 1) {
      expect(nextTask(state, ctx({ rng: constant(0) }))).toEqual({
        kind: 'recall',
        key: A,
        review: true,
      });
    }
  });

  it('agrees with the recall at the due moment: r at dueFrom + h', () => {
    const state = stateOf(
      { [A]: item({ lastAt: NOW - DAY_MS, memory: { difficulty: 6, stability: 3.7 } }) },
      { observed: 0.85, gaps: [5 * 3_600_000] },
    );
    const from = dueFrom(state, A) ?? Number.NaN;
    const h = horizonMs(state);
    const recall = retrievability(3.7, (from + h - (NOW - DAY_MS)) / DAY_MS);
    expect(Math.abs(recall - requestedRetention(state))).toBeLessThan(1e-9);
  });

  it('has no due moment for a kana that is not learned', () => {
    const state = stateOf({ [A]: learning() });
    expect(dueFrom(state, A)).toBeNull();
    expect(dueFrom(state, I)).toBeNull();
  });
});

describe('learning steps', () => {
  it('make a kana ready after 30 s, 1, 2, 4 and 8 minutes', () => {
    for (const streak of [0, 1, 2, 3, 4]) {
      const wait = STEP_MS * 2 ** streak;
      // The limit is reached, so a ready kana is told from a waiting one by the order alone:
      // い waits with the oldest `lastTask`, あ has the newest.
      const others = {
        [I]: learning({ lastAt: NOW - 1, lastTask: 8 }),
        [U]: learning({ lastAt: NOW - 1, lastTask: 9 }),
        [E]: learning({ lastAt: NOW - 1, lastTask: 9 }),
      };
      const early = learning({ lastAt: NOW - wait + 1, streak, lastTask: 99 });
      const onTime = learning({ lastAt: NOW - wait, streak, lastTask: 99 });
      expect(keyOf(nextTask(stateOf({ ...others, [A]: early }), ctx()))).toBe(I);
      expect(keyOf(nextTask(stateOf({ ...others, [A]: onTime }), ctx()))).toBe(A);
    }
  });

  it('puts a ready kana before an introduction but a waiting one after it', () => {
    const waiting = { [A]: learning({ lastAt: NOW - STEP_MS + 1 }) };
    expect(nextTask(stateOf(waiting), ctx())?.kind).toBe('introduction');
    const ready = { [A]: learning({ lastAt: NOW - STEP_MS }) };
    expect(nextTask(stateOf(ready), ctx())?.kind).toBe('recall');
  });
});

describe('the previous kana', () => {
  it('is left out while another is available', () => {
    const items = {
      [A]: learning({ lastAt: NOW - STEP_MS }),
      [I]: learning({ lastAt: NOW - STEP_MS, lastTask: 4 }),
    };
    expect(keyOf(nextTask(stateOf(items), ctx({ previous: A })))).toBe(I);
    expect(keyOf(nextTask(stateOf(items), ctx({ previous: I })))).toBe(A);
  });

  it('is left out of the due kana too', () => {
    const items = {
      [A]: item({ lastAt: NOW - 100 * DAY_MS }),
      [I]: item({ lastAt: NOW - 90 * DAY_MS }),
    };
    expect(keyOf(nextTask(stateOf(items), ctx({ previous: A })))).toBe(I);
  });

  it('is taken when nothing else is left and it is due', () => {
    const state = stateOf({ ...everything(), [A]: item({ lastAt: NOW - 100 * DAY_MS }) });
    expect(nextTask(state, ctx({ previous: A }))).toEqual({
      kind: 'recall',
      key: A,
      review: true,
    });
  });

  it('is taken when nothing else is left and it is learning', () => {
    const state = stateOf({ ...everything(), [A]: learning({ lastAt: NOW }) });
    expect(nextTask(state, ctx({ previous: A }))?.key).toBe(A);
  });

  it('is not taken when it is learned and not due', () => {
    expect(nextTask(stateOf(everything()), ctx({ previous: A }))).toBeNull();
  });
});

describe('the kind of a learning task', () => {
  it('is a recognition one time in four, with one draw per task', () => {
    const state = stateOf({ [A]: learning({ lastAt: NOW - STEP_MS }) });
    const rng = seeded(7);
    let recognitions = 0;
    const picks = 10_000;
    for (let i = 0; i < picks; i += 1) {
      const task = nextTask(state, ctx({ rng }));
      if (task?.kind === 'recognition') recognitions += 1;
    }
    expect(Math.abs(recognitions / picks - RECOGNITION_SHARE)).toBeLessThan(0.02);
  });

  it('draws once for a learning kana and not at all for an introduction or a review', () => {
    let draws = 0;
    const counting: Rng = {
      next() {
        draws += 1;
        return 0.5;
      },
    };
    nextTask(stateOf({}), ctx({ rng: counting }));
    nextTask(stateOf({ [A]: item({ lastAt: NOW - 100 * DAY_MS }) }), ctx({ rng: counting }));
    expect(draws).toBe(0);
    nextTask(stateOf({ [A]: learning({ lastAt: NOW - STEP_MS }) }), ctx({ rng: counting }));
    expect(draws).toBe(1);
  });

  it('is the recognition of a key below the share and a recall at or above it', () => {
    const state = stateOf({ [A]: learning({ lastAt: NOW - STEP_MS }) });
    expect(nextTask(state, ctx({ rng: constant(RECOGNITION_SHARE - 0.001) }))).toEqual({
      kind: 'recognition',
      key: A,
    });
    expect(nextTask(state, ctx({ rng: constant(RECOGNITION_SHARE) }))).toEqual({
      kind: 'recall',
      key: A,
      review: false,
    });
  });
});

describe('introductions', () => {
  const many = (keys: readonly LearnKanaKey[]): Record<string, ItemState> =>
    Object.fromEntries(keys.map((key) => [key, learning({ lastAt: NOW - 1000 })]));

  it('stop at four kana learning', () => {
    const three = stateOf(many([A, I, U]));
    expect(nextTask(three, ctx())).toEqual({ kind: 'introduction', key: E });
    const four = stateOf(many([A, I, U, E]));
    expect(nextTask(four, ctx())?.kind).toBe('recall');
  });

  it('stop at one kana learning under full pressure', () => {
    const items = many([A]);
    const under = stateOf(items, { observed: 0.8 });
    expect(nextTask(under, ctx())?.kind).toBe('recall');
    expect(nextTask(stateOf({}, { observed: 0.8 }), ctx())?.kind).toBe('introduction');
  });

  it('do not count learned kana', () => {
    const items = { ...many([A, I]), [U]: item(), [E]: item() };
    expect(nextTask(stateOf(items), ctx())).toEqual({ kind: 'introduction', key: O });
  });

  it('make が wait for か to be learned', () => {
    const rowsBefore = trackItems('hiragana')
      .slice(
        0,
        trackItems('hiragana').findIndex((k) => k.key === GA),
      )
      .map((k) => k.key)
      .filter((key) => key !== KA);
    const base = Object.fromEntries(rowsBefore.map((key) => [key, item()]));
    const withLearning = stateOf({ ...base, [KA]: learning({ lastAt: NOW - 1000 }) });
    expect(nextTask(withLearning, ctx())).not.toEqual({ kind: 'introduction', key: GA });
    const withLearned = stateOf({ ...base, [KA]: item() });
    const task = nextTask(withLearned, ctx());
    expect(task?.kind).toBe('introduction');
    expect(parts(task?.key)).toEqual(task?.key === GA ? [KA] : parts(task?.key));
  });

  it('make きゃ wait for き and や', () => {
    const first = (state: ModelState): LearnKanaKey | undefined => {
      for (const { key } of trackItems('hiragana')) {
        if (
          !state.items.has(key) &&
          parts(key).every((p) => state.items.get(p)?.phase === 'learned')
        ) {
          return key;
        }
      }
      return undefined;
    };
    const mixed = stateOf({ [KI]: item(), [YA]: learning({ lastAt: NOW - 1000 }) });
    expect(nextTask(mixed, ctx())).not.toEqual({ kind: 'introduction', key: KYA });
    expect(first(mixed)).not.toBe(KYA);
    const both = stateOf({ [KI]: item(), [YA]: item() });
    const task = nextTask(both, ctx());
    expect(task).toEqual({ kind: 'introduction', key: first(both) });
  });

  it('skip a kana that waits and take the next eligible one in track order', () => {
    const state = stateOf({ [A]: item(), [I]: item(), [U]: item(), [E]: item(), [O]: item() });
    expect(nextTask(state, ctx())).toEqual({ kind: 'introduction', key: KA });
    const afterKa = stateOf({
      [A]: item(),
      [I]: item(),
      [U]: item(),
      [E]: item(),
      [O]: item(),
      [KA]: learning({ lastAt: NOW - 1000 }),
    });
    const next = nextTask(afterKa, ctx());
    expect(next?.kind).toBe('introduction');
    expect(next?.key).not.toBe(GA);
  });
});

describe('the other track', () => {
  const hiraganaLearned = (count: number): Record<string, ItemState> =>
    Object.fromEntries(
      trackItems('hiragana')
        .slice(0, count)
        .filter((k) => k.parts.length === 0)
        .map((k) => [k.key, item()]),
    );
  const count = (items: Record<string, unknown>): number => Object.keys(items).length;

  it('is not used while it has no introduced kana, however far the track is ahead', () => {
    const items = hiraganaLearned(60);
    expect(count(items)).toBeGreaterThan(TRACK_LAG + 1);
    const task = nextTask(stateOf(items), ctx());
    expect(task?.kind).toBe('introduction');
    expect(ITEMS.get(task?.key ?? A)?.track).toBe('hiragana');
  });

  it('is used when it has a kana and lags by more than ten', () => {
    const items = { ...hiraganaLearned(60), 'katakana:ア': item() };
    const lag = count(items) - 1 - 1;
    expect(lag).toBeGreaterThan(TRACK_LAG);
    expect(nextTask(stateOf(items), ctx())).toEqual({ kind: 'introduction', key: 'katakana:イ' });
  });

  it('is not used at a lag of exactly ten', () => {
    const base = hiraganaLearned(60);
    const keys = Object.keys(base).slice(0, TRACK_LAG + 1);
    const items = { ...Object.fromEntries(keys.map((k) => [k, item()])), 'katakana:ア': item() };
    const task = nextTask(stateOf(items), ctx());
    expect(ITEMS.get(task?.key ?? A)?.track).toBe('hiragana');
  });

  it('is not used when the selected track is behind', () => {
    const items = { ...hiraganaLearned(60), 'katakana:ア': item() };
    const task = nextTask(stateOf(items), ctx({ track: 'katakana' }));
    expect(task).toEqual({ kind: 'introduction', key: 'katakana:イ' });
    const back = nextTask(
      stateOf({ [A]: item(), 'katakana:ア': item(), 'katakana:イ': item() }),
      ctx(),
    );
    expect(ITEMS.get(back?.key ?? A)?.track).toBe('hiragana');
  });

  it('is not used when the selected track has nothing eligible and the other is lagging', () => {
    const track: Track = 'hiragana';
    const state = stateOf(everythingOf(track));
    expect(nextTask(state, ctx())).toBeNull();
  });
});

function everythingOf(track: Track): Record<string, ItemState> {
  return Object.fromEntries(trackItems(track).map((k) => [k.key, item()]));
}

function parts(key: LearnKanaKey | undefined): readonly LearnKanaKey[] {
  return key === undefined ? [] : (ITEMS.get(key)?.parts ?? []);
}

describe('nothing to offer', () => {
  it('is null when every kana is learned and none is due', () => {
    expect(nextTask(stateOf(everything()), ctx())).toBeNull();
  });

  it('offers a waiting kana at the limit instead of ending the session', () => {
    const items = Object.fromEntries([A, I, U, E].map((key) => [key, learning({ lastAt: NOW })]));
    expect(nextTask(stateOf(items), ctx())).not.toBeNull();
  });
});
