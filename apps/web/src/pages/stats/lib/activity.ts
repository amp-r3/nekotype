import type { LearnState } from '@nekotype/shared/types';
import { mondayOf } from './days';

export type ActivityDay = {
  /** Recall answers of both tracks. */
  readonly answers: number;
  /** The day lies inside a run of `activeDays`. */
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

/** The days that hold anything: answers (S7), a place in an active run, a day of the current streak. */
export function activityDays(state: LearnState, today: number): Map<number, ActivityDay> {
  const days = new Map<number, ActivityDay>();
  const at = (day: number): ActivityDay =>
    days.get(day) ?? { answers: 0, active: false, run: false };
  for (const track of ['hiragana', 'katakana'] as const) {
    for (const [key, buckets] of Object.entries(state.recallBuckets[track])) {
      const sum = Object.values(buckets).reduce((total, count) => total + count, 0);
      const day = Number(key);
      const was = at(day);
      days.set(day, { ...was, answers: was.answers + sum });
    }
  }
  for (const [first, last] of state.activeDays) {
    for (let day = first; day <= last; day++) days.set(day, { ...at(day), active: true });
  }
  // The current streak is the last run, while it ends today or yesterday (`currentStreak`).
  const last = state.activeDays[state.activeDays.length - 1];
  if (last !== undefined && last[1] >= today - 1) {
    for (let day = last[0]; day <= last[1]; day++) days.set(day, { ...at(day), run: true });
  }
  return days;
}

/** How many of the last `window` days up to `today` fall in a run of `activeDays`. */
export function activeDaysIn(state: LearnState, today: number, window: number): number {
  const from = today - window + 1;
  return state.activeDays.reduce(
    (total, [first, last]) =>
      total + Math.max(0, Math.min(last, today) - Math.max(first, from) + 1),
    0,
  );
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
