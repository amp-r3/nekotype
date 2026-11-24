import type { LearnKanaKey, LogEvent } from '@nekotype/shared/types';
import { describe, expect, it } from 'vitest';
import { DAY_MS, STEP_MS, TRACK_LAG } from './constants';
import { createFold } from './fold';
import type { ItemState, ModelState } from './fold';
import { isWeak, reasonOf } from './home';
import { ITEMS, trackItems } from './items';
import { dueFrom } from './learner';
import { nextTask } from './planner';
import type { KanaLog, LogStats } from './stats';
import { syntheticLog } from './testing';
import { describe as describeState } from './view';
import type { KanaView } from './view';

const NOW = 1_000_000_000_000;
const A = 'hiragana:あ';
const I = 'hiragana:い';
const U = 'hiragana:う';
const RA = 'hiragana:ら';
const KATA_A = 'katakana:ア';
const KATA_I = 'katakana:イ';

function item(over: Partial<ItemState> = {}): ItemState {
  return {
    phase: 'learned',
    memory: { stability: 4, difficulty: 5 },
    lastAt: NOW,
    lastDay: 0,
    streak: 0,
    lastTask: 0,
    ...over,
  };
}
const learning = (over: Partial<ItemState> = {}): ItemState =>
  item({ phase: 'learning', memory: { stability: 0.1, difficulty: 5 }, ...over });

function stateOf(
  items: ReadonlyMap<LearnKanaKey, ItemState>,
  confusions: ModelState['confusions'] = new Map(),
): ModelState {
  const base = createFold({ targetMs: 1500, stats: false }).state;
  return { ...base, items, confusions };
}

function statsOf(kana: ReadonlyMap<LearnKanaKey, KanaLog> = new Map()): LogStats {
  return { kana, days: new Map(), started: 0, finished: 0, introducedIn: new Map() };
}

const recalls = (oks: readonly boolean[]): KanaLog => ({
  recall: oks.map((ok) => ({ ms: 1000, ok })),
  recognitions: 0,
  recognitionErrors: 0,
});

function reasonFor(
  items: ReadonlyMap<LearnKanaKey, ItemState>,
  over: {
    stats?: LogStats;
    confusions?: ModelState['confusions'];
    track?: 'hiragana' | 'katakana';
  } = {},
) {
  const state = stateOf(items, over.confusions);
  const view = describeState(state, over.stats ?? statsOf());
  return reasonOf(state, view, { now: NOW, track: over.track ?? 'hiragana' });
}

/** A view of a learning kana with `recall` answers and `confusions` mix-ups. */
function viewWith(oks: readonly boolean[], confusionCounts: readonly number[] = []): KanaView {
  const state = stateOf(
    new Map([[A, learning()]]),
    new Map([
      [
        A,
        new Map(
          confusionCounts.map((count, i) => [trackItems('hiragana')[i + 1]?.key ?? I, count]),
        ),
      ],
    ]),
  );
  const kana = describeState(state, statsOf(new Map([[A, recalls(oks)]]))).kana.get(A);
  if (kana === undefined) throw new Error('no view');
  return kana;
}

describe('isWeak', () => {
  const hit = (n: number, ok: number): boolean[] => Array.from({ length: n }, (_, i) => i < ok);

  it('needs 5 recalls with accuracy under 0.8', () => {
    expect(isWeak(viewWith(hit(4, 0)))).toBe(false); // 4 recalls: too few
    expect(isWeak(viewWith(hit(5, 0)))).toBe(true);
    expect(isWeak(viewWith(hit(5, 4)))).toBe(false); // accuracy 0.8 is not under it
    expect(isWeak(viewWith(hit(10, 7)))).toBe(true); // 0.7
    expect(isWeak(viewWith(hit(10, 8)))).toBe(false);
  });

  it('is weak from 2 confusions, summed over the kana given instead', () => {
    expect(isWeak(viewWith([], [1]))).toBe(false);
    expect(isWeak(viewWith([], [2]))).toBe(true);
    expect(isWeak(viewWith([], [1, 1]))).toBe(true);
  });

  it('is never true for a kana that is not learning', () => {
    const state = stateOf(
      new Map([
        [A, item()],
        [I, item()],
      ]),
      new Map([[A, new Map([[I, 9]])]]),
    );
    const view = describeState(
      state,
      statsOf(new Map([[A, recalls([false, false, false, false, false])]])),
    );
    expect(isWeak(view.kana.get(A) ?? viewWith([]))).toBe(false);
    expect(isWeak(view.kana.get(U) ?? viewWith([]))).toBe(false); // locked
  });
});

describe('reasonOf', () => {
  it('review: counts the kana due now, of both tracks', () => {
    const old = item({ lastAt: NOW - 100 * DAY_MS });
    const items = new Map<LearnKanaKey, ItemState>([
      [A, old],
      [KATA_A, old],
      [I, item()],
    ]);
    const state = stateOf(items);
    const view = describeState(state, statsOf());
    const due = [...view.kana.values()].filter((k) => k.dueFrom !== null && k.dueFrom <= NOW);
    expect(due).toHaveLength(2);
    expect(reasonOf(state, view, { now: NOW, track: 'hiragana' })).toEqual({
      kind: 'review',
      due: 2,
    });
  });

  it('weak: the weak learning kana in track order, when the first task is a learning kana', () => {
    const items = new Map<LearnKanaKey, ItemState>([
      [A, learning({ lastAt: NOW - STEP_MS })],
      [I, learning({ lastAt: NOW - STEP_MS })],
    ]);
    const stats = statsOf(
      new Map([
        [I, recalls([false, false, false, false, false])],
        [A, recalls([false, false, false, false, false])],
      ]),
    );
    expect(reasonFor(items, { stats })).toEqual({ kind: 'weak', keys: [A, I] });
  });

  it('learning: counts the learning kana when none is weak', () => {
    const items = new Map<LearnKanaKey, ItemState>([
      [A, learning({ lastAt: NOW - STEP_MS })],
      [KATA_A, learning({ lastAt: NOW - STEP_MS })],
    ]);
    expect(reasonFor(items)).toEqual({ kind: 'learning', learning: 2 });
  });

  it('new: the first introduction and its row', () => {
    expect(reasonFor(new Map())).toEqual({ kind: 'new', key: A, row: 'hiragana:vowels' });
    expect(reasonFor(new Map(), { track: 'katakana' })).toEqual({
      kind: 'new',
      key: KATA_A,
      row: ITEMS.get(KATA_A)?.row,
    });
  });

  it('new: the other track under TRACK_LAG', () => {
    const hira = trackItems('hiragana').slice(0, TRACK_LAG + 2);
    const items = new Map<LearnKanaKey, ItemState>(hira.map((k) => [k.key, item()]));
    items.set(KATA_A, item());
    const reason = reasonFor(items, { track: 'hiragana' });
    expect(reason).toEqual({ kind: 'new', key: KATA_I, row: ITEMS.get(KATA_I)?.row });
    expect(reason.kind === 'new' && reason.row.startsWith('katakana:')).toBe(true);
  });

  it('none: the smallest dueFrom of the learned kana', () => {
    const items = new Map<LearnKanaKey, ItemState>(
      [...ITEMS.keys()].map((key, i) => [key, item({ lastAt: NOW + (i + 1) * DAY_MS })]),
    );
    const state = stateOf(items);
    const view = describeState(state, statsOf());
    const reason = reasonOf(state, view, { now: NOW, track: 'hiragana' });
    const smallest = Math.min(...[...ITEMS.keys()].map((key) => dueFrom(state, key) ?? Infinity));
    expect(reason).toEqual({ kind: 'none', nextAt: smallest });
    expect(smallest).toBeGreaterThan(NOW);
    expect(
      nextTask(state, { now: NOW, track: 'hiragana', previous: null, rng: { next: () => 0 } }),
    ).toBeNull();
  });

  it('a first-time state is a vowels introduction without a draw', () => {
    expect(reasonFor(new Map([[RA, item()]]))).toMatchObject({ kind: 'new' });
  });
});

/** The class of the planner's first task, whatever the draw says. */
function classOf(task: ReturnType<typeof nextTask>): string {
  if (task === null) return 'none';
  if (task.kind === 'introduction') return `new:${task.key}`;
  if (task.kind === 'recall' && task.review) return 'review';
  return 'learning';
}

describe('reasonOf along a played log', () => {
  const events: readonly LogEvent[] = syntheticLog({ answers: 1500, seed: 1 });

  it('agrees with the planner for either draw at about 200 points of one log', () => {
    const fold = createFold({ targetMs: 1500, stats: true });
    const step = Math.max(1, Math.floor(events.length / 200));
    const seen = new Set<string>();
    events.forEach((event, i) => {
      fold.apply(event);
      if (i % step !== 0) return;
      for (const track of ['hiragana', 'katakana'] as const) {
        const now = event.at + 1000;
        const { state, stats } = fold.snapshot();
        if (stats === null) throw new Error('no stats');
        const view = describeState(state, stats);
        const reason = reasonOf(state, view, { now, track });
        const ctx = { now, track, previous: null } as const;
        const low = classOf(nextTask(state, { ...ctx, rng: { next: () => 0 } }));
        const high = classOf(nextTask(state, { ...ctx, rng: { next: () => 0.99 } }));
        expect(low, `event ${i}`).toBe(high);
        seen.add(reason.kind);
        if (reason.kind === 'new') expect(low).toBe(`new:${reason.key}`);
        else if (reason.kind === 'review') {
          expect(low).toBe('review');
          const due = [...view.kana.values()].filter((k) => k.dueFrom !== null && k.dueFrom <= now);
          expect(reason.due).toBe(due.length);
        } else if (reason.kind === 'none') {
          expect(low).toBe('none');
          const smallest = Math.min(
            ...[...view.kana.values()].map((k) => k.dueFrom ?? Number.POSITIVE_INFINITY),
          );
          expect(reason.nextAt).toBe(smallest);
          expect(reason.nextAt).toBeGreaterThan(now);
        } else {
          expect(low).toBe('learning');
        }
      }
    });
    // The played log goes through more than one kind.
    expect(seen.has('new')).toBe(true);
    expect(seen.size).toBeGreaterThan(1);
  });
});
