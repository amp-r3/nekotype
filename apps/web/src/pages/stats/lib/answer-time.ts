import { addBuckets, quartilesOf } from '@/entities/learn';
import type { DayBuckets } from '@nekotype/shared/types';
import type { Period } from './selection';
import { axisOf } from './trend';
import type { Axis } from './trend';

export type DayBar = {
  /** The local day; for a weekly bar its Monday. */
  readonly day: number;
  readonly answers: number;
  readonly lo: number;
  readonly mid: number;
  readonly hi: number;
};

const MIN_DAYS_ALL = 14;
const WEEKLY_OVER = 45;
const STEPS_MS = [250, 500, 1000, 2000, 5000];

/** The Monday of the week of a local day (day 0, 1970-01-01, was a Thursday). */
export function mondayOf(day: number): number {
  return day - ((((day + 3) % 7) + 7) % 7);
}

/** The days the period covers: `'7'` and `'30'` back from today, `'all'` from the first answer. */
export function spanDays(days: DayBuckets, period: Period, today: number): number {
  if (period !== 'all') return Number(period);
  const first = Object.keys(days)
    .map(Number)
    .reduce((low, day) => Math.min(low, day), today);
  return Math.max(MIN_DAYS_ALL, today - first + 1);
}

/**
 * The bars of the answer-time chart: the days of the period that have answers; when the axis holds
 * more than 45 days, one bar per Monday-to-Sunday week from the added buckets (S6).
 */
export function dayBars(
  days: DayBuckets,
  period: Period,
  today: number,
): { weekly: boolean; span: number; bars: DayBar[] } {
  const span = spanDays(days, period, today);
  const weekly = span > WEEKLY_OVER;
  const from = today - span + 1;
  const groups = new Map<number, Record<string, number>>();
  for (const [key, buckets] of Object.entries(days)) {
    const day = Number(key);
    if (day < from || day > today) continue;
    const group = weekly ? mondayOf(day) : day;
    groups.set(group, addBuckets(groups.get(group) ?? {}, buckets));
  }
  const bars: DayBar[] = [];
  for (const [day, buckets] of groups) {
    const quartiles = quartilesOf(buckets);
    if (quartiles === null) continue;
    const answers = Object.values(buckets).reduce((sum, count) => sum + count, 0);
    bars.push({ day, answers, ...quartiles });
  }
  bars.sort((a, b) => a.day - b.day);
  return { weekly, span, bars };
}

/**
 * The y axis in ms: covers every `lo`, `hi` and the target, with at most four intervals of 250,
 * 500 ms or more; the target is never on the upper edge.
 */
export function msAxis(bars: readonly DayBar[], targetMs: number): Axis {
  const low = Math.min(targetMs, ...bars.map((bar) => bar.lo));
  const high = Math.max(targetMs, ...bars.map((bar) => bar.hi));
  return axisOf(Math.max(0, low), Math.floor(high) + 1, STEPS_MS);
}
