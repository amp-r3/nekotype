import {
  addBuckets,
  addLearnStats,
  decayLearnStat,
  mergeActiveDays,
  isLearnKanaKey,
  mergeEntries,
  mergeEntry,
  mergeRecent,
  mergeUnlocked,
} from './learn-runtime';
import type {
  LearnDelta,
  LearnEntry,
  LearnKanaKey,
  LearnState,
  LearnStat,
  RecallAnswer,
  Track,
} from './types';

// The merge of the learning state as one function (p5-plan.md, D11) and the patch of the small
// `learn` column (ADR 082). A `LearnDelta` has the fields of `LearnState`, so the same function
// merges a state with a delta, a delta with a delta, and a snapshot with an outbox.

/** The neutral element: nothing unlocked. The client's initial state adds the vowels. */
export function emptyLearnState(): LearnState {
  return {
    unlocked: { hiragana: [], katakana: [] },
    entries: {},
    recent: {},
    stats: {},
    activeDays: [],
    recallBuckets: { hiragana: {}, katakana: {} },
  };
}

/** Adds the statistics of `b`, then decays: the order of the server (`decay(add(a, b))`). */
function mergeStats(
  a: Readonly<Record<LearnKanaKey, LearnStat>>,
  b: Readonly<Record<LearnKanaKey, LearnStat>>,
): Record<LearnKanaKey, LearnStat> {
  const merged: Record<string, LearnStat> = { ...a };
  for (const [key, stat] of Object.entries(b)) {
    const mine = merged[key];
    merged[key] = decayLearnStat(mine === undefined ? stat : addLearnStats(mine, stat));
  }
  return merged;
}

function mergeRecentMaps(
  a: LearnState['recent'],
  b: LearnState['recent'],
): Record<LearnKanaKey, RecallAnswer[]> {
  const merged: Record<string, RecallAnswer[]> = {};
  for (const [key, list] of Object.entries(a)) merged[key] = [...list];
  for (const [key, list] of Object.entries(b)) merged[key] = mergeRecent(merged[key] ?? [], list);
  return merged;
}

/**
 * Merges `b` into `a` by the rules of storage-sync.md. `b` is the later side: statistics of a kana
 * that only `a` holds are not decayed again, so merging in the server's order gives the stored
 * state. `order` is the track order of each track; without it the unlocked kana are sorted by key,
 * as the server keeps them.
 */
export function mergeLearn(
  a: LearnState,
  b: LearnState,
  order?: Readonly<Record<Track, readonly LearnKanaKey[]>>,
): LearnState {
  return {
    unlocked: {
      hiragana: mergeUnlocked(order?.hiragana ?? [], a.unlocked.hiragana, b.unlocked.hiragana),
      katakana: mergeUnlocked(order?.katakana ?? [], a.unlocked.katakana, b.unlocked.katakana),
    },
    entries: mergeEntries(a.entries, b.entries),
    recent: mergeRecentMaps(a.recent, b.recent),
    stats: mergeStats(a.stats, b.stats),
    activeDays: mergeActiveDays(a.activeDays, b.activeDays),
    recallBuckets: {
      hiragana: addBuckets(a.recallBuckets.hiragana, b.recallBuckets.hiragana),
      katakana: addBuckets(a.recallBuckets.katakana, b.recallBuckets.katakana),
    },
  };
}

/** The part of `learn` that a batch reads: the small fields whole, the touched kana only. */
export type StoredLearn = {
  readonly unlocked: LearnState['unlocked'];
  readonly activeDays: LearnState['activeDays'];
  readonly entries: Readonly<Record<LearnKanaKey, LearnEntry>>;
  readonly stats: Readonly<Record<LearnKanaKey, LearnStat>>;
};

/** A `LearnStat` as a merge patch: a `mixups` key that the merge removed is `null`. */
export type StatPatch = {
  readonly recognitions: number;
  readonly recognitionErrors: number;
  readonly mixups: Readonly<Record<string, number | null>>;
};

/** The JSON Merge Patch (RFC 7396) of the `learn` column. */
export type LearnPatch = {
  readonly unlocked: LearnState['unlocked'];
  readonly activeDays: LearnState['activeDays'];
  readonly entries: Readonly<Record<LearnKanaKey, LearnEntry>>;
  readonly stats: Readonly<Record<LearnKanaKey, StatPatch>>;
};

/**
 * The patch of the `learn` column for a delta (ADR 082): `unlocked` (sorted by key) and
 * `activeDays` whole, the changed entries, and the statistics of the touched kana, with `null` for
 * each `mixups` key that is stored and that the decay dropped. `stored.entries` and `stored.stats`
 * need the touched kana only. Applied to the stored column it gives the `learn` part of
 * `mergeLearn(stored, delta)`.
 */
export function patchLearn(stored: StoredLearn, delta: LearnDelta): LearnPatch {
  const entries: Record<string, LearnEntry> = {};
  for (const [key, entry] of Object.entries(delta.entries)) {
    const mine = isLearnKanaKey(key) ? stored.entries[key] : undefined;
    entries[key] = mine === undefined ? entry : mergeEntry(mine, entry);
  }
  const stats: Record<string, StatPatch> = {};
  for (const [key, added] of Object.entries(delta.stats)) {
    const mine = isLearnKanaKey(key) ? stored.stats[key] : undefined;
    const merged = decayLearnStat(mine === undefined ? added : addLearnStats(mine, added));
    const mixups: Record<string, number | null> = { ...merged.mixups };
    for (const mixup of Object.keys(mine?.mixups ?? {})) {
      if (!(mixup in merged.mixups)) mixups[mixup] = null;
    }
    stats[key] = {
      recognitions: merged.recognitions,
      recognitionErrors: merged.recognitionErrors,
      mixups,
    };
  }
  return {
    unlocked: {
      hiragana: mergeUnlocked([], stored.unlocked.hiragana, delta.unlocked.hiragana),
      katakana: mergeUnlocked([], stored.unlocked.katakana, delta.unlocked.katakana),
    },
    activeDays: mergeActiveDays(stored.activeDays, delta.activeDays),
    entries,
    stats,
  };
}
