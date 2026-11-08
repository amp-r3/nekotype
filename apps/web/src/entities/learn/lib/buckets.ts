import type { DayBuckets, Track } from '@nekotype/shared/types';
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

/**
 * The day's median: the midpoint of the bucket that holds the ⌈n / 2⌉-th shortest answer time.
 * `null` when the day has no answers.
 */
export function dailyMedian(days: DayBuckets, day: number): number | null {
  const buckets = days[String(day)];
  if (buckets === undefined) return null;
  const entries = Object.entries(buckets)
    .map(([bucket, count]) => [Number(bucket), count] as const)
    .sort((a, b) => a[0] - b[0]);
  const total = entries.reduce((sum, [, count]) => sum + count, 0);
  if (total === 0) return null;
  const rank = Math.ceil(total / 2);
  let seen = 0;
  for (const [bucket, count] of entries) {
    seen += count;
    if (seen >= rank) return BUCKET_MS * bucket + BUCKET_MS / 2;
  }
  return null;
}

/** The days of a track that have answers, ascending, with their medians. */
export function dailyMedians(
  all: Readonly<Record<Track, DayBuckets>>,
  track: Track,
): { day: number; ms: number }[] {
  const days = all[track];
  return Object.keys(days)
    .map(Number)
    .sort((a, b) => a - b)
    .flatMap((day) => {
      const ms = dailyMedian(days, day);
      return ms === null ? [] : [{ day, ms }];
    });
}
