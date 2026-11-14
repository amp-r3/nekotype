import type { DayBuckets } from '@nekotype/shared/types';
import { BUCKET_MS, bucketOf, dropOldDays } from '@nekotype/shared/runtime';

/** Counts a recall answer time in its day's bucket; days older than 365 are dropped. */
export function addRecallTime(days: DayBuckets, day: number, ms: number): DayBuckets {
  const key = String(day);
  const bucket = String(bucketOf(ms));
  const buckets = days[key] ?? {};
  return dropOldDays({
    ...days,
    [key]: { ...buckets, [bucket]: (buckets[bucket] ?? 0) + 1 },
  });
}

export type Quartiles = { readonly lo: number; readonly mid: number; readonly hi: number };

/** The number of answers in a day. */
export function dayAnswers(days: DayBuckets, day: number): number {
  return Object.values(days[String(day)] ?? {}).reduce((sum, count) => sum + count, 0);
}

/** The bucket-wise sum of two sets of buckets. */
export function addBuckets(
  a: Readonly<Record<string, number>>,
  b: Readonly<Record<string, number>>,
): Record<string, number> {
  const sum: Record<string, number> = { ...a };
  for (const [bucket, count] of Object.entries(b)) sum[bucket] = (sum[bucket] ?? 0) + count;
  return sum;
}

/**
 * The quartiles of answer times held in buckets: the midpoints of the buckets that hold the
 * ⌈n / 4⌉-th, ⌈n / 2⌉-th and ⌈3n / 4⌉-th shortest time. `null` without answers.
 */
export function quartilesOf(buckets: Readonly<Record<string, number>>): Quartiles | null {
  const entries = Object.entries(buckets)
    .map(([bucket, count]) => [Number(bucket), count] as const)
    .sort((a, b) => a[0] - b[0]);
  const total = entries.reduce((sum, [, count]) => sum + count, 0);
  if (total === 0) return null;
  const at = (rank: number): number => {
    let seen = 0;
    for (const [bucket, count] of entries) {
      seen += count;
      if (seen >= rank) return BUCKET_MS * bucket + BUCKET_MS / 2;
    }
    return 0;
  };
  return {
    lo: at(Math.ceil(total / 4)),
    mid: at(Math.ceil(total / 2)),
    hi: at(Math.ceil((total * 3) / 4)),
  };
}

/** True when some day of the track has answers (a day with an empty bucket record does not count). */
export function hasAnswers(days: DayBuckets): boolean {
  return Object.values(days).some((buckets) => quartilesOf(buckets) !== null);
}
