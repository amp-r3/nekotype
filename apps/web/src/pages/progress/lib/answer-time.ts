import type { DayLog } from '@nekotype/model';
import type { Track } from '@nekotype/shared/types';
import { median } from '@/entities/learn';
import type { Period } from './days';
import { MIN_DAYS_ALL, mondayOf } from './days';
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

const WEEKLY_OVER = 45;
const STEPS_MS = [250, 500, 1000, 2000, 5000];

/** True when some day holds a recall answer of the track. */
export function hasRecall(days: ReadonlyMap<number, DayLog>, track: Track): boolean {
  for (const log of days.values()) if (log.recall[track].length > 0) return true;
  return false;
}

/** The days the period covers: `'7'` and `'30'` back from today, `'all'` from the first answer. */
export function spanDays(
  days: ReadonlyMap<number, DayLog>,
  track: Track,
  period: Period,
  today: number,
): number {
  if (period !== 'all') return Number(period);
  let first = today;
  for (const [day, log] of days) if (log.recall[track].length > 0) first = Math.min(first, day);
  return Math.max(MIN_DAYS_ALL, today - first + 1);
}

/**
 * The exact quartiles of answer times: the ⌈n / 4⌉-th and the ⌈3n / 4⌉-th shortest, and the median
 * (the mean of the two middle times when n is even). `null` without answers.
 */
export function quartilesOf(times: readonly number[]): Pick<DayBar, 'lo' | 'mid' | 'hi'> | null {
  const n = times.length;
  if (n === 0) return null;
  const sorted = [...times].sort((a, b) => a - b);
  return {
    lo: sorted[Math.ceil(n / 4) - 1] ?? 0,
    mid: median(sorted),
    hi: sorted[Math.ceil((n * 3) / 4) - 1] ?? 0,
  };
}

/**
 * The bars of the answer-time chart: the days of the period that have recall answers of the track;
 * when the axis holds more than 45 days, one bar per Monday-to-Sunday week from the answers of its
 * days (S8).
 */
export function dayBars(
  days: ReadonlyMap<number, DayLog>,
  track: Track,
  period: Period,
  today: number,
): { weekly: boolean; span: number; bars: DayBar[] } {
  const span = spanDays(days, track, period, today);
  const weekly = span > WEEKLY_OVER;
  const from = today - span + 1;
  const groups = new Map<number, number[]>();
  for (const [day, log] of days) {
    const times = log.recall[track];
    if (day < from || day > today || times.length === 0) continue;
    const group = weekly ? mondayOf(day) : day;
    const have = groups.get(group);
    if (have === undefined) groups.set(group, [...times]);
    else have.push(...times);
  }
  const bars: DayBar[] = [];
  for (const [day, times] of groups) {
    const quartiles = quartilesOf(times);
    if (quartiles !== null) bars.push({ day, answers: times.length, ...quartiles });
  }
  bars.sort((a, b) => a.day - b.day);
  return { weekly, span, bars };
}

/**
 * The y axis in ms: covers every `lo` and `hi`, with at most four intervals of 250, 500 ms or
 * more; the highest `hi` is never on the upper edge. Without bars, 0 to 1000 ms.
 */
export function msAxis(bars: readonly DayBar[]): Axis {
  if (bars.length === 0) return axisOf(0, 1000, STEPS_MS);
  const low = Math.min(...bars.map((bar) => bar.lo));
  const high = Math.max(...bars.map((bar) => bar.hi));
  return axisOf(Math.max(0, low), Math.floor(high) + 1, STEPS_MS);
}
