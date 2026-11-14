import type { LearnState, TestResult } from '@nekotype/shared/types';
import { localDay } from '@/entities/learn';
import { mondayOf } from './days';

export type ActivityDay = {
  /** Recall answers of both tracks. */
  readonly answers: number;
  /** Finished typing tests, repeats included. */
  readonly tests: number;
  /** The day lies inside a run of `activeDays`. */
  readonly active: boolean;
};

export type Level = 0 | 1 | 2 | 3 | 4 | 5;

const LEVELS: readonly Level[] = [0, 1, 2, 3, 4, 5];
const LEVEL_STARTS = [1, 10, 25, 50, 100];
const MIN_WEEKS = 12;
const MAX_WEEKS = 26;

/** The days that hold anything: answers (S7), tests by `endedAt`, or a place in an active run. */
export function activityDays(
  state: LearnState,
  results: readonly TestResult[],
): Map<number, ActivityDay> {
  const days = new Map<number, ActivityDay>();
  const at = (day: number): ActivityDay => days.get(day) ?? { answers: 0, tests: 0, active: false };
  for (const track of ['hiragana', 'katakana'] as const) {
    for (const [key, buckets] of Object.entries(state.recallBuckets[track])) {
      const sum = Object.values(buckets).reduce((total, count) => total + count, 0);
      const day = Number(key);
      const was = at(day);
      days.set(day, { ...was, answers: was.answers + sum });
    }
  }
  for (const result of results) {
    const day = localDay(result.endedAt);
    const was = at(day);
    days.set(day, { ...was, tests: was.tests + 1 });
  }
  for (const [first, last] of state.activeDays) {
    for (let day = first; day <= last; day++) days.set(day, { ...at(day), active: true });
  }
  return days;
}

/** The fill step of a day: the answers against 1, 10, 25, 50, 100; an active day without answers is 1. */
export function levelOf(answers: number, active: boolean): Level {
  const reached = LEVEL_STARTS.filter((start) => answers >= start).length;
  return LEVELS[Math.max(reached, active ? 1 : 0)] ?? 0;
}

/** Weeks to draw: from the first day with anything, 12 to 26; 12 without one. */
export function weeksFor(firstDay: number | null, today: number): number {
  if (firstDay === null) return MIN_WEEKS;
  const weeks = Math.ceil((today - firstDay) / 7) + 1;
  return Math.min(MAX_WEEKS, Math.max(MIN_WEEKS, weeks));
}

/** The days of the grid, column by column: from the Monday of the first week to today. */
export function gridDays(today: number, weeks: number): number[] {
  const first = mondayOf(today) - (weeks - 1) * 7;
  return Array.from({ length: today - first + 1 }, (_, index) => first + index);
}
