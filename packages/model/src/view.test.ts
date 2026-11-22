import type { LearnKanaKey } from '@nekotype/shared/types';
import { describe, expect, it } from 'vitest';
import { DAY_MS, MASTERED_STABILITY_DAYS } from './constants';
import { createFold } from './fold';
import type { ItemState, ModelState } from './fold';
import { dueFrom, requestedRetention } from './learner';
import { trackItems } from './items';
import { intervalFor } from './fsrs';
import type { LogStats } from './stats';
import { answer, intro, start } from './testing';
import { describe as describeState } from './view';

const KA = 'hiragana:か';
const KI = 'hiragana:き';
const A = 'hiragana:あ';
const TARGET = 1500;

const EMPTY_STATS: LogStats = { kana: new Map(), days: new Map(), started: 0, finished: 0 };

function item(over: Partial<ItemState> & Pick<ItemState, 'phase'>): ItemState {
  return {
    memory: { stability: 1, difficulty: 5 },
    lastAt: 1_000_000,
    lastDay: 0,
    streak: 0,
    lastTask: 0,
    ...over,
  };
}

/** A state with the given items and nothing else. */
function stateOf(items: ReadonlyMap<LearnKanaKey, ItemState>): ModelState {
  return { ...createFold({ targetMs: TARGET, stats: false }).state, items };
}

/** Entries of one phase for the given kana. */
function entries(keys: readonly LearnKanaKey[], phase: ItemState['phase']) {
  return keys.map((key) => [key, item({ phase })] satisfies [LearnKanaKey, ItemState]);
}

function view(items: [LearnKanaKey, ItemState][], stats: LogStats = EMPTY_STATS) {
  return describeState(stateOf(new Map(items)), stats);
}

describe('describe: chart states', () => {
  it('covers every kana of both tracks; a kana without an entry is locked', () => {
    const v = view([]);
    expect(v.kana.size).toBe(229);
    expect(v.kana.get(KA)).toMatchObject({
      state: 'locked',
      dueFrom: null,
      nextReviewAt: null,
      stability: null,
      recall: [],
      medianMs: 0,
      accuracy: 0,
      recognitions: 0,
      recognitionErrors: 0,
      confusions: [],
    });
  });

  it('learning, learned and mastered; 20.99 days is learned and 21 is mastered', () => {
    const v = view([
      [A, item({ phase: 'learning' })],
      [
        KA,
        item({
          phase: 'learned',
          memory: { stability: MASTERED_STABILITY_DAYS - 0.01, difficulty: 5 },
        }),
      ],
      [
        KI,
        item({ phase: 'learned', memory: { stability: MASTERED_STABILITY_DAYS, difficulty: 5 } }),
      ],
    ]);
    expect(v.kana.get(A)?.state).toBe('learning');
    expect(v.kana.get(A)?.stability).toBeNull();
    expect(v.kana.get(KA)?.state).toBe('learned');
    expect(v.kana.get(KI)?.state).toBe('mastered');
    expect(v.mastered).toEqual({ hiragana: 1, katakana: 0 });
    expect(v.introduced).toEqual({ hiragana: 3, katakana: 0 });
  });

  it('a lapsed kana (phase learning with a memory) is learning', () => {
    const v = view([[KA, item({ phase: 'learning', memory: { stability: 30, difficulty: 5 } })]]);
    expect(v.kana.get(KA)?.state).toBe('learning');
  });
});

describe('describe: schedule', () => {
  it('gives dueFrom and nextReviewAt for a known memory', () => {
    const memory = { stability: 4, difficulty: 6 };
    const state = stateOf(new Map([[KA, item({ phase: 'learned', memory, lastAt: 5_000_000 })]]));
    const v = describeState(state, EMPTY_STATS).kana.get(KA);
    expect(v?.stability).toBe(4);
    expect(v?.nextReviewAt).toBe(5_000_000 + 4 * DAY_MS);
    expect(v?.dueFrom).toBe(dueFrom(state, KA));
    // At the default retention the interval is the stability itself, shifted by the horizon.
    expect(requestedRetention(state)).toBe(0.9);
    expect(intervalFor(4, 0.9)).toBeCloseTo(4, 6);
    expect(v?.dueFrom).toBeCloseTo(5_000_000 + 4 * DAY_MS - 43_200_000, -2);
  });
});

describe('describe: statistics of a kana', () => {
  const stats = (recall: { ms: number; ok: boolean }[]): LogStats => ({
    ...EMPTY_STATS,
    kana: new Map([[KA, { recall, recognitions: 4, recognitionErrors: 1 }]]),
  });

  it('median of an odd and of an even count; accuracy; recognition counts', () => {
    const odd = view(
      [],
      stats([
        { ms: 900, ok: true },
        { ms: 300, ok: false },
        { ms: 600, ok: true },
      ]),
    );
    expect(odd.kana.get(KA)?.medianMs).toBe(600);
    expect(odd.kana.get(KA)?.accuracy).toBeCloseTo(2 / 3, 10);
    expect(odd.kana.get(KA)?.recognitions).toBe(4);
    expect(odd.kana.get(KA)?.recognitionErrors).toBe(1);
    const even = view(
      [],
      stats([
        { ms: 100, ok: true },
        { ms: 400, ok: true },
        { ms: 200, ok: true },
        { ms: 1000, ok: false },
      ]),
    );
    expect(even.kana.get(KA)?.medianMs).toBe(300);
    expect(even.kana.get(KA)?.accuracy).toBe(0.75);
  });
});

describe('describe: confusions', () => {
  it('highest count first, then track order', () => {
    const fold = createFold({ targetMs: TARGET, stats: true });
    let n = 0;
    const wrong = (given: LearnKanaKey, times: number) => {
      for (let i = 0; i < times; i += 1) {
        n += 1;
        fold.apply(answer(KA, { at: n, n, ok: false, task: 'recognition', wrong: given }));
      }
    };
    wrong('hiragana:さ', 1);
    wrong('hiragana:き', 1);
    wrong('katakana:カ', 3);
    wrong('hiragana:た', 2);
    const snap = fold.snapshot();
    const v = describeState(snap.state, snap.stats ?? EMPTY_STATS);
    expect(v.kana.get(KA)?.confusions).toEqual([
      { key: 'katakana:カ', count: 3 },
      { key: 'hiragana:た', count: 2 },
      { key: 'hiragana:き', count: 1 },
      { key: 'hiragana:さ', count: 1 },
    ]);
    expect(v.kana.get(KI)?.confusions).toEqual([]);
  });
});

describe('describe: opens next, track counts and the katakana suggestion', () => {
  const basic = trackItems('hiragana').filter((i) => i.category === 'basic');

  it('opens the first new kana of each track whose parts are learned', () => {
    expect(view([]).opensNext).toEqual({ hiragana: A, katakana: 'katakana:ア' });
    const learnedA = view([[A, item({ phase: 'learned' })]]);
    expect(learnedA.opensNext.hiragana).toBe('hiragana:い');
    const learningA = view([[A, item({ phase: 'learning' })]]);
    expect(learningA.opensNext.hiragana).toBe('hiragana:い');
  });

  it('skips a new kana whose parts are not learned', () => {
    const keys = basic.map((i) => i.key);
    const open = view(entries(keys, 'learned')).opensNext.hiragana;
    expect(open).toBe('hiragana:が');
    const blocked = view([
      ...entries(
        keys.filter((k) => k !== KA),
        'learned',
      ),
      ...entries([KA], 'learning'),
    ]).opensNext.hiragana;
    expect(blocked).not.toBeNull();
    expect(blocked).not.toBe('hiragana:が');
    const parts = trackItems('hiragana').find((i) => i.key === blocked)?.parts ?? [];
    expect(parts).not.toContain(KA);
  });

  it('is null when every kana of the track is introduced', () => {
    const keys = trackItems('katakana').map((i) => i.key);
    expect(view(entries(keys, 'learned')).opensNext.katakana).toBeNull();
  });

  it('suggests katakana at 46 learned basic hiragana, not at 45', () => {
    const keys = basic.map((i) => i.key);
    expect(keys).toHaveLength(46);
    expect(view(entries(keys.slice(0, 45), 'learned')).suggestKatakana).toBe(false);
    expect(view(entries(keys, 'learned')).suggestKatakana).toBe(true);
    expect(
      view([...entries(keys.slice(0, 45), 'learned'), ...entries(keys.slice(45), 'learning')])
        .suggestKatakana,
    ).toBe(false);
  });

  it('does not count katakana toward the suggestion', () => {
    const keys = trackItems('katakana').map((i) => i.key);
    expect(view(entries(keys, 'learned')).suggestKatakana).toBe(false);
  });
});

describe('describe: from a folded log', () => {
  it('carries the statistics through', () => {
    const fold = createFold({ targetMs: TARGET, stats: true });
    fold.apply(start(0, { at: 0, n: 1 }));
    fold.apply(intro(KA, { at: 1, n: 2 }));
    fold.apply(answer(KA, { at: 2, n: 3, ms: 800 }));
    const snap = fold.snapshot();
    const stats = snap.stats ?? EMPTY_STATS;
    const v = describeState(snap.state, stats);
    expect(v.stats).toBe(stats);
    expect(v.kana.get(KA)).toMatchObject({
      state: 'learning',
      recall: [{ ms: 800, ok: true }],
      medianMs: 800,
      accuracy: 1,
    });
  });
});
