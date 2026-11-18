import { BUCKET_DAYS, mergeRecent, isLearnKanaKey } from './learn-runtime';
import type {
  DayBuckets,
  LearnDelta,
  LearnEntry,
  LearnKanaKey,
  LearnStat,
  RecallAnswer,
  Track,
} from './types';

// Per-key updates of the two large learning columns (ADR 078). The server reads only the keys a
// batch touches, applies the merge rules to them and writes the result as a JSON Merge Patch
// (RFC 7396): a list or a day's object is given whole, `null` deletes a day.

export type TouchedKeys = {
  /** Keys of `delta.recent`. */
  readonly kana: readonly LearnKanaKey[];
  /** Days of `delta.recallBuckets`, per track. */
  readonly days: Readonly<Record<Track, readonly string[]>>;
};

export function touchedKeys(delta: LearnDelta): TouchedKeys {
  return {
    kana: Object.keys(delta.recent).filter(isLearnKanaKey),
    days: {
      hiragana: Object.keys(delta.recallBuckets.hiragana),
      katakana: Object.keys(delta.recallBuckets.katakana),
    },
  };
}

/** `stored`: the stored lists of the touched kana only. Returns the new list of every touched kana. */
export function patchRecent(
  stored: Readonly<Record<LearnKanaKey, readonly RecallAnswer[]>>,
  delta: LearnDelta['recent'],
): Record<LearnKanaKey, RecallAnswer[]> {
  const patch: Record<string, RecallAnswer[]> = {};
  for (const key of Object.keys(delta).filter(isLearnKanaKey)) {
    patch[key] = mergeRecent(stored[key] ?? [], delta[key] ?? []);
  }
  return patch;
}

export type BucketsPatch = {
  /** The new buckets of every touched day, and `null` for every day that leaves the window. */
  readonly patch: Record<string, Readonly<Record<string, number>> | null>;
  /** The newest day of the track after the batch; `null` while the track has no day. */
  readonly newest: number | null;
};

/**
 * One track (ADR 082). `storedDays`: the stored buckets of the touched days only; `storedNewest`:
 * the newest stored day, `bucket_newest`, `null` for a track without a day. The patch names with
 * `null` every stored day that is more than 365 days behind the newest day of the stored and the
 * touched days together: the days between the old and the new lower bound, at most 366.
 */
export function patchBuckets(
  storedDays: DayBuckets,
  storedNewest: number | null,
  delta: DayBuckets,
): BucketsPatch {
  let newest = storedNewest ?? -Infinity;
  for (const day of Object.keys(delta)) newest = Math.max(newest, Number(day));
  if (newest === -Infinity) return { patch: {}, newest: null };
  const oldest = newest - BUCKET_DAYS;

  const patch: Record<string, Readonly<Record<string, number>> | null> = {};
  if (storedNewest !== null) {
    // Stored days lie in [storedNewest - 365, storedNewest]: those below `oldest` leave.
    const last = Math.min(oldest - 1, storedNewest);
    for (let day = storedNewest - BUCKET_DAYS; day <= last; day += 1) patch[String(day)] = null;
  }
  for (const [day, added] of Object.entries(delta)) {
    if (Number(day) < oldest) {
      patch[day] = null;
      continue;
    }
    const sum: Record<string, number> = { ...storedDays[day] };
    for (const [bucket, count] of Object.entries(added)) sum[bucket] = (sum[bucket] ?? 0) + count;
    patch[day] = sum;
  }
  return { patch, newest };
}

function pick<T>(source: Readonly<Record<string, T>>, keys: ReadonlySet<string>, inside: boolean) {
  const out: Record<string, T> = {};
  for (const [key, value] of Object.entries(source)) {
    if (keys.has(key) === inside) out[key] = value;
  }
  return out;
}

function splitDays(days: DayBuckets, count: number): [DayBuckets, DayBuckets] {
  const order = Object.keys(days).sort((a, b) => Number(a) - Number(b));
  const head = new Set(order.slice(0, count));
  return [pick(days, head, true), pick(days, head, false)];
}

/** Caps the learning part of a batch (Q1). `head` goes into the batch, `rest` stays in `delta`. */
export function splitLearnDelta(
  delta: LearnDelta,
  caps: { readonly kana: number; readonly days: number },
): { readonly head: LearnDelta; readonly rest: LearnDelta } {
  const touched = new Set<string>([
    ...Object.keys(delta.entries),
    ...Object.keys(delta.recent),
    ...Object.keys(delta.stats),
  ]);
  const inHead = new Set([...touched].sort().slice(0, caps.kana));
  const [hHead, hRest] = splitDays(delta.recallBuckets.hiragana, caps.days);
  const [kHead, kRest] = splitDays(delta.recallBuckets.katakana, caps.days);
  const entries = (inside: boolean): Record<string, LearnEntry> =>
    pick(delta.entries, inHead, inside);
  const stats = (inside: boolean): Record<string, LearnStat> => pick(delta.stats, inHead, inside);
  const recent = (inside: boolean): Record<string, readonly RecallAnswer[]> =>
    pick(delta.recent, inHead, inside);
  return {
    head: {
      entries: entries(true),
      unlocked: delta.unlocked,
      recent: recent(true),
      stats: stats(true),
      activeDays: delta.activeDays,
      recallBuckets: { hiragana: hHead, katakana: kHead },
    },
    rest: {
      entries: entries(false),
      unlocked: { hiragana: [], katakana: [] },
      recent: recent(false),
      stats: stats(false),
      activeDays: [],
      recallBuckets: { hiragana: hRest, katakana: kRest },
    },
  };
}
