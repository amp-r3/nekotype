import type { DayLog } from '@nekotype/model';
import { mondayOf } from './days';

export type ActivityDay = {
  /** Recall answers of both tracks. */
  readonly answers: number;
  /** The day holds an answer of any task. */
  readonly active: boolean;
  /** The day is counted by the current streak. */
  readonly run: boolean;
};

export type Level = 0 | 1 | 2 | 3 | 4 | 5;

const LEVELS: readonly Level[] = [0, 1, 2, 3, 4, 5];
const LEVEL_STARTS = [1, 10, 25, 50, 100];
const MAX_WEEKS = 26;
const MIN_CELL = 16;
const MAX_CELL = 28;
const GAP = 4;
/** The weekday names column (24 px) and the space after it (8 px). */
const LABELS = 32;
/** What the map draws before it has a width, and without a layout. */
const FALLBACK = { weeks: 12, cell: MIN_CELL } as const;

/**
 * The days that hold anything: the day's recall answers of both tracks (S8), a day with any answer
 * is active, and the days of the current streak are a run (`streakOfDays`).
 */
export function activityDays(
  days: ReadonlyMap<number, DayLog>,
  today: number,
): Map<number, ActivityDay> {
  const result = new Map<number, ActivityDay>();
  for (const [day, log] of days) {
    if (log.answers === 0) continue;
    result.set(day, {
      answers: log.recall.hiragana.length + log.recall.katakana.length,
      active: true,
      run: false,
    });
  }
  // The current streak ends today, or yesterday while today has no answer.
  let day = result.has(today) ? today : today - 1;
  for (let entry = result.get(day); entry !== undefined; entry = result.get(day)) {
    result.set(day, { ...entry, run: true });
    day -= 1;
  }
  return result;
}

/** How many of the last `window` days up to `today` hold an answer. */
export function activeDaysIn(
  days: ReadonlyMap<number, DayLog>,
  today: number,
  window: number,
): number {
  let count = 0;
  for (let day = today - window + 1; day <= today; day++) {
    if ((days.get(day)?.answers ?? 0) > 0) count += 1;
  }
  return count;
}

/** The fill step of a day: the answers against 1, 10, 25, 50, 100; an active day without answers is 1. */
export function levelOf(answers: number, active: boolean): Level {
  const reached = LEVEL_STARTS.filter((start) => answers >= start).length;
  return LEVELS[Math.max(reached, active ? 1 : 0)] ?? 0;
}

/**
 * The frame of the map for the width it has (decision 137): as many weeks as fit at the smallest
 * cell, at most 26, then cells that grow to the edge up to 28 px (not rounded: the last column must reach it). It never depends on the history.
 */
export function fitMap(width: number | null): { readonly weeks: number; readonly cell: number } {
  if (width === null || width <= 0) return FALLBACK;
  const room = width - LABELS;
  const weeks = Math.max(1, Math.min(MAX_WEEKS, Math.floor((room + GAP) / (MIN_CELL + GAP))));
  const cell = Math.max(MIN_CELL, Math.min(MAX_CELL, (room - (weeks - 1) * GAP) / weeks));
  return { weeks, cell };
}

/** The days of the grid, column by column: from the Monday of the first week to today. */
export function gridDays(today: number, weeks: number): number[] {
  const first = mondayOf(today) - (weeks - 1) * 7;
  return Array.from({ length: today - first + 1 }, (_, index) => first + index);
}
