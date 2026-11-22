import { describe, expect, it } from 'vitest';
import {
  BATCH_CAPS,
  addBuckets,
  addCounters,
  addLearnStats,
  applyBatch,
  emptyLearnState,
  isLearnKanaKey,
  isLearnState,
  mergeActiveDays,
  mergeEntries,
  mergeLearn,
  mergeRecent,
  mergeUnlocked,
  patchBuckets,
  patchLearn,
  patchRecent,
  splitLearnDelta,
  touchedKeys,
} from './runtime';
import {
  KANA_KEYS,
  YEAR_FIRST_DAY,
  applyMergePatch,
  generateBatch,
  generateYear,
  intIn,
  seededRng,
} from './testing';
import type {
  Counters,
  DayBuckets,
  LearnDelta,
  LearnEntry,
  LearnKanaKey,
  LearnState,
  LearnStat,
  RecallAnswer,
  Rng,
  Snapshot,
  SyncRequestV2,
  Track,
} from './types';

// The property, convergence, splitting and equivalence tests of p5-plan.md D12 (acceptance 14, 15
// and 17). Seeded generators, a loop of cases, the failing seed in the message.

const CASES = 500;
const TRACKS: readonly Track[] = ['hiragana', 'katakana'];
const KANA: readonly LearnKanaKey[] = [
  'hiragana:あ',
  'hiragana:い',
  'hiragana:う',
  'hiragana:え',
  'hiragana:お',
  'katakana:ア',
  'katakana:イ',
  'katakana:ウ',
];
const ORDER: Record<Track, readonly LearnKanaKey[]> = {
  hiragana: KANA.filter((key) => key.startsWith('hiragana:')),
  katakana: KANA.filter((key) => key.startsWith('katakana:')),
};

function eachCase(check: (rng: Rng) => void): void {
  for (let seed = 1; seed <= CASES; seed += 1) {
    try {
      check(seededRng(seed));
    } catch (error) {
      throw new Error(`failing seed ${seed}: ${String(error)}`, { cause: error });
    }
  }
}

function chance(rng: Rng, p: number): boolean {
  return rng.next() < p;
}

function some<T>(rng: Rng, items: readonly T[], p: number): T[] {
  return items.filter(() => chance(rng, p));
}

function entry(rng: Rng): LearnEntry {
  const box = intIn(rng, 0, 5);
  return {
    box: box === 0 ? 0 : box === 1 ? 1 : box === 2 ? 2 : box === 3 ? 3 : box === 4 ? 4 : 5,
    dueAt: intIn(rng, 0, 9),
    updatedAt: intIn(rng, 0, 9),
  };
}

function entries(rng: Rng): Record<LearnKanaKey, LearnEntry> {
  const out: Record<string, LearnEntry> = {};
  for (const key of some(rng, KANA, 0.5)) out[key] = entry(rng);
  return out;
}

function answers(rng: Rng): RecallAnswer[] {
  const list: RecallAnswer[] = [];
  for (let i = intIn(rng, 1, 10); i > 0; i -= 1) {
    list.push({ at: intIn(rng, 1, 25), ms: intIn(rng, 5, 30) * 100, ok: chance(rng, 0.5) });
  }
  // One answer per `at`, as one device writes them.
  return [...new Map(list.map((answer) => [answer.at, answer])).values()].sort(
    (a, b) => a.at - b.at,
  );
}

function recent(rng: Rng): Record<LearnKanaKey, RecallAnswer[]> {
  const out: Record<string, RecallAnswer[]> = {};
  for (const key of some(rng, KANA, 0.5)) out[key] = answers(rng);
  return out;
}

/** Counts that cross the decay line often, so the removal of a `mixups` key is exercised. */
function stat(rng: Rng, big: boolean): LearnStat {
  const mixups: Record<string, number> = {};
  for (const other of some(rng, KANA, 0.5)) mixups[other] = intIn(rng, 1, big ? 5 : 3);
  const recognitions = big ? intIn(rng, 150, 420) : intIn(rng, 1, 260);
  return { recognitions, recognitionErrors: intIn(rng, 0, 40), mixups };
}

function stats(rng: Rng, big: boolean, cap = Infinity): Record<LearnKanaKey, LearnStat> {
  const out: Record<string, LearnStat> = {};
  for (const key of some(rng, KANA, 0.5)) {
    const one = stat(rng, big);
    out[key] = { ...one, recognitions: Math.min(one.recognitions, cap) };
  }
  return out;
}

function unlockedOf(rng: Rng): LearnState['unlocked'] {
  return {
    hiragana: some(rng, ORDER.hiragana, 0.5),
    katakana: some(rng, ORDER.katakana, 0.5),
  };
}

function activeDays(rng: Rng): [number, number][] {
  const runs: [number, number][] = [];
  let at = intIn(rng, 0, 5);
  for (let i = intIn(rng, 0, 3); i > 0; i -= 1) {
    const first = at;
    const last = first + intIn(rng, 0, 4);
    runs.push([first, last]);
    at = last + intIn(rng, 2, 6);
  }
  return runs;
}

function days(rng: Rng, from: number, to: number, density: number): DayBuckets {
  const out: Record<string, Record<string, number>> = {};
  for (let day = from; day <= to; day += 1) {
    if (!chance(rng, density)) continue;
    const buckets: Record<string, number> = {};
    for (let i = intIn(rng, 1, 3); i > 0; i -= 1) {
      buckets[String(intIn(rng, 0, 100))] = intIn(rng, 1, 9);
    }
    out[String(day)] = buckets;
  }
  return out;
}

/**
 * A delta: any days, statistics that may cross the decay line. A delta that is merged into another
 * delta has been decayed by the client, so `decayed` keeps its statistics at 200 or fewer.
 */
function deltaOf(rng: Rng, decayed = false): LearnDelta {
  const base = intIn(rng, 250, 450);
  return {
    entries: entries(rng),
    unlocked: unlockedOf(rng),
    recent: recent(rng),
    stats: stats(rng, false, decayed ? 200 : Infinity),
    activeDays: activeDays(rng),
    recallBuckets: {
      hiragana: days(rng, base - 30, base + (chance(rng, 0.3) ? 500 : 20), 0.2),
      katakana: days(rng, base - 30, base + (chance(rng, 0.3) ? 500 : 20), 0.2),
    },
  };
}

/** A stored state: statistics already decayed once, a window of 365 days per track. */
function storedOf(rng: Rng): LearnState {
  const newest = intIn(rng, 300, 450);
  return {
    unlocked: unlockedOf(rng),
    entries: entries(rng),
    recent: recent(rng),
    stats: stats(rng, true),
    activeDays: activeDays(rng),
    recallBuckets: {
      hiragana: days(rng, newest - 365, newest, 0.15),
      katakana: chance(rng, 0.2) ? {} : days(rng, newest - 365, newest, 0.15),
    },
  };
}

/** Idempotent, commutative and associative. */
function semilattice<T>(name: string, gen: (rng: Rng) => T, merge: (a: T, b: T) => T): void {
  it(`${name}: idempotent, commutative and associative`, () => {
    eachCase((rng) => {
      const a = gen(rng);
      const b = gen(rng);
      const c = gen(rng);
      expect(merge(a, a)).toEqual(a);
      expect(merge(a, b)).toEqual(merge(b, a));
      expect(merge(merge(a, b), c)).toEqual(merge(a, merge(b, c)));
    });
  });
}

/** Commutative and associative, for additive merges (no decay in these cases). */
function additive<T>(name: string, gen: (rng: Rng) => T, merge: (a: T, b: T) => T): void {
  it(`${name}: commutative and associative`, () => {
    eachCase((rng) => {
      const a = gen(rng);
      const b = gen(rng);
      const c = gen(rng);
      expect(merge(a, b)).toEqual(merge(b, a));
      expect(merge(merge(a, b), c)).toEqual(merge(a, merge(b, c)));
    });
  });
}

describe('set-like merges (acceptance 14)', () => {
  semilattice('mergeEntries', entries, mergeEntries);
  semilattice(
    'mergeUnlocked (track order)',
    (rng) => some(rng, ORDER.hiragana, 0.5),
    (a, b) => mergeUnlocked(ORDER.hiragana, a, b),
  );
  semilattice(
    'mergeUnlocked (sorted by key)',
    (rng) => some(rng, ORDER.hiragana, 0.5),
    (a, b) => mergeUnlocked([], a, b),
  );
  semilattice('mergeRecent', answers, mergeRecent);
  semilattice('mergeActiveDays', activeDays, mergeActiveDays);
});

describe('additive merges (acceptance 14)', () => {
  additive('addLearnStats', (rng) => stat(rng, false), addLearnStats);
  additive('addBuckets', (rng) => days(rng, 100, 500, 0.2), addBuckets);
  additive(
    'addCounters',
    (rng): Counters => ({
      started: intIn(rng, 0, 9),
      finished: intIn(rng, 0, 9),
    }),
    addCounters,
  );
});

describe('convergence of two devices (acceptance 15)', () => {
  /** What two devices must agree on; the statistics are left out: their decay is not associative. */
  function agreed(state: LearnState): unknown {
    return {
      unlocked: state.unlocked,
      entries: state.entries,
      recent: state.recent,
      activeDays: state.activeDays,
      recallBuckets: state.recallBuckets,
    };
  }

  function asState(delta: LearnDelta): LearnState {
    return { ...delta };
  }

  it('deltas exchanged in any order end in equal states', () => {
    eachCase((rng) => {
      const start = storedOf(rng);
      const a = asState(deltaOf(rng));
      const b = asState(deltaOf(rng));
      const deviceA = mergeLearn(mergeLearn(start, a, ORDER), b, ORDER);
      const deviceB = mergeLearn(mergeLearn(start, b, ORDER), a, ORDER);
      const server = mergeLearn(start, mergeLearn(a, b, ORDER), ORDER);
      expect(agreed(deviceA)).toEqual(agreed(deviceB));
      expect(agreed(server)).toEqual(agreed(deviceA));
    });
  });

  it('mergeLearn with the empty state changes nothing', () => {
    eachCase((rng) => {
      const state = storedOf(rng);
      expect(mergeLearn(state, emptyLearnState())).toEqual({
        ...state,
        unlocked: {
          hiragana: [...state.unlocked.hiragana].sort(),
          katakana: [...state.unlocked.katakana].sort(),
        },
      });
    });
  });
});

describe('splitting a delta (acceptance 17)', () => {
  const caps = { kana: 3, days: 4 };

  it('mergeLearn(head, rest) is the delta and head respects the caps', () => {
    eachCase((rng) => {
      const delta = deltaOf(rng, true);
      const { head, rest } = splitLearnDelta(delta, caps);
      const kana = new Set([
        ...Object.keys(head.entries),
        ...Object.keys(head.recent),
        ...Object.keys(head.stats),
      ]);
      expect(kana.size).toBeLessThanOrEqual(caps.kana);
      for (const track of TRACKS) {
        expect(Object.keys(head.recallBuckets[track]).length).toBeLessThanOrEqual(caps.days);
      }
      // `stats` of one kana are on one side only, so there is nothing to decay twice.
      const whole = mergeLearn(head, rest, ORDER);
      const expected = mergeLearn(emptyLearnState(), delta, ORDER);
      expect(whole).toEqual(expected);
      expect(mergeLearn(mergeLearn(storedOf(seededRng(3)), head, ORDER), rest, ORDER)).toEqual(
        mergeLearn(mergeLearn(storedOf(seededRng(3)), rest, ORDER), head, ORDER),
      );
    });
  });
});

describe('the per-key patch equals the full merge (acceptance 17)', () => {
  type Columns = {
    learn: Record<string, unknown>;
    recent: Record<string, unknown>;
    buckets: Record<string, unknown>;
    newest: Partial<Record<Track, number>>;
  };

  function pick<T>(source: Readonly<Record<string, T>>, keys: Iterable<string>): Record<string, T> {
    const out: Record<string, T> = {};
    for (const key of keys) {
      const value = source[key];
      if (value !== undefined) out[key] = value;
    }
    return out;
  }

  function columnsOf(learn: LearnState): Columns {
    const { recent: recentList, recallBuckets, ...rest } = learn;
    const newest: Partial<Record<Track, number>> = {};
    for (const track of TRACKS) {
      const keys = Object.keys(recallBuckets[track]).map(Number);
      if (keys.length > 0) newest[track] = Math.max(...keys);
    }
    return { learn: { ...rest }, recent: { ...recentList }, buckets: { ...recallBuckets }, newest };
  }

  function stateOf(columns: Columns): LearnState {
    const state: unknown = JSON.parse(
      JSON.stringify({ ...columns.learn, recent: columns.recent, recallBuckets: columns.buckets }),
    );
    if (!isLearnState(state)) throw new Error('the patched columns are not a learning state');
    return state;
  }

  /** What the server does with the touched keys of a batch (backend.md, "Applying a batch"). */
  function serverApply(columns: Columns, delta: LearnDelta): Columns {
    const learn = stateOf(columns);
    const touched = touchedKeys(delta);
    const learnPatch = patchLearn(
      {
        unlocked: learn.unlocked,
        activeDays: learn.activeDays,
        entries: pick(learn.entries, Object.keys(delta.entries)),
        stats: pick(learn.stats, Object.keys(delta.stats)),
      },
      delta,
    );
    const recentPatch = patchRecent(pick(learn.recent, touched.kana), delta.recent);
    const bucketsPatch: Record<string, unknown> = {};
    const newest = { ...columns.newest };
    for (const track of TRACKS) {
      const { patch, newest: next } = patchBuckets(
        pick(learn.recallBuckets[track], touched.days[track]),
        columns.newest[track] ?? null,
        delta.recallBuckets[track],
      );
      bucketsPatch[track] = patch;
      if (next !== null) newest[track] = next;
    }
    const merged = {
      learn: applyMergePatch(columns.learn, learnPatch),
      recent: applyMergePatch(columns.recent, recentPatch),
      buckets: applyMergePatch(columns.buckets, bucketsPatch),
    };
    return {
      learn: asRecord(merged.learn),
      recent: asRecord(merged.recent),
      buckets: asRecord(merged.buckets),
      newest,
    };
  }

  function asRecord(value: unknown): Record<string, unknown> {
    if (typeof value !== 'object' || value === null) throw new Error('not an object');
    return Object.fromEntries(Object.entries(value));
  }

  it('patchLearn, patchRecent and patchBuckets give mergeLearn(stored, delta), over generated cases', () => {
    eachCase((rng) => {
      const stored = storedOf(rng);
      const delta = deltaOf(rng);
      const after = serverApply(columnsOf(stored), delta);
      expect(stateOf(after)).toEqual(mergeLearn(stored, delta));
      // The newest day is kept in step with the stored buckets.
      expect(after.newest).toEqual(columnsOf(stateOf(after)).newest);
    });
  });

  it('removes a mixups key that the decay drops', () => {
    const stored: LearnState = {
      ...emptyLearnState(),
      stats: {
        'hiragana:あ': {
          recognitions: 190,
          recognitionErrors: 20,
          mixups: { 'hiragana:い': 1, 'hiragana:う': 6 },
        },
      },
    };
    const delta: LearnDelta = {
      ...emptyLearnState(),
      stats: { 'hiragana:あ': { recognitions: 20, recognitionErrors: 2, mixups: {} } },
    };
    const patch = patchLearn(
      { unlocked: stored.unlocked, activeDays: [], entries: {}, stats: stored.stats },
      delta,
    );
    expect(patch.stats['hiragana:あ']?.mixups).toEqual({ 'hiragana:い': null, 'hiragana:う': 3 });
    expect(stateOf(serverApply(columnsOf(stored), delta))).toEqual(mergeLearn(stored, delta));
  });

  it('drops the days of a gap of more than 365 days and keeps the track in step', () => {
    const stored: LearnState = {
      ...emptyLearnState(),
      recallBuckets: { hiragana: { '100': { '5': 1 }, '200': { '6': 2 } }, katakana: {} },
    };
    const delta: LearnDelta = {
      ...emptyLearnState(),
      recallBuckets: { hiragana: { '900': { '7': 3 } }, katakana: { '5': { '1': 1 } } },
    };
    const after = serverApply(columnsOf(stored), delta);
    expect(stateOf(after).recallBuckets).toEqual({
      hiragana: { '900': { '7': 3 } },
      katakana: { '5': { '1': 1 } },
    });
    expect(after.newest).toEqual({ hiragana: 900, katakana: 5 });
  });

  it('a track with no stored day takes its newest from the batch', () => {
    const { patch, newest } = patchBuckets({}, null, { '40': { '1': 1 }, '30': { '2': 2 } });
    expect(newest).toBe(40);
    expect(patch).toEqual({ '40': { '1': 1 }, '30': { '2': 2 } });
    expect(patchBuckets({}, null, {})).toEqual({ patch: {}, newest: null });
  });

  it('the applied batch equals the server model for statistics, counters and settings too (ADR 082)', () => {
    eachCase((rng) => {
      const learn = storedOf(rng);
      const delta = deltaOf(rng);
      const snapshot: Snapshot = {
        settings: null,
        counters: { started: 5, finished: 4 },
        learn,
      };
      const request: SyncRequestV2 = {
        v: 2,
        deviceId: 'd',
        seq: intIn(rng, 2, 9),
        delta: { counters: { started: 2, finished: 1 }, learn: delta, settings: null },
      };
      const applied = applyBatch(snapshot, request);
      expect(applied.learn).toEqual(stateOf(serverApply(columnsOf(learn), delta)));
      expect(applied.counters).toEqual({ started: 7, finished: 5 });
    });
  });
});

describe('a year of learning', () => {
  const year = generateYear({ seed: 11, keys: KANA_KEYS });
  const snapshot: Snapshot = {
    settings: null,
    counters: year.counters,
    learn: year.learn,
  };

  it('a learning batch and a batch at the caps are applied like the full merge', () => {
    for (const kind of ['learning', 'capped'] as const) {
      const batch = generateBatch({ seed: 5, keys: KANA_KEYS, kind });
      const applied = applyBatch(snapshot, batch);
      expect(applied.learn).toEqual(mergeLearn(year.learn, batch.delta.learn));
      expect(applied.learn.recent).toBeDefined();
    }
  });

  it('a batch at the caps passes splitLearnDelta whole', () => {
    const batch = generateBatch({ seed: 5, keys: KANA_KEYS, kind: 'capped' });
    const { head, rest } = splitLearnDelta(batch.delta.learn, BATCH_CAPS);
    expect(mergeLearn(head, rest)).toEqual(mergeLearn(emptyLearnState(), batch.delta.learn));
    expect(Object.keys(rest.entries)).toHaveLength(0);
  });

  it('the learning batch pushes the oldest day out and the gap leaves nothing behind', () => {
    const batch = generateBatch({ seed: 5, keys: KANA_KEYS, kind: 'learning' });
    const applied = applyBatch(snapshot, batch);
    const hiragana = Object.keys(applied.learn.recallBuckets.hiragana);
    expect(hiragana).toHaveLength(365);
    expect(hiragana).not.toContain(String(YEAR_FIRST_DAY));
    expect(hiragana).toContain(String(YEAR_FIRST_DAY + 1));
    expect(Object.keys(applied.learn.recallBuckets.katakana)).toHaveLength(365);
    expect(Object.keys(applied.learn.recent).every(isLearnKanaKey)).toBe(true);
  });
});
