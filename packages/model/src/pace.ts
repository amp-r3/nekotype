import type { AnswerEvent, TaskKind } from '@nekotype/shared/types';
import { PACE_MIN, PACE_QUANTILE, PACE_STEP } from './constants';

/**
 * The learner's pace (ADR 115): per task type graded by time and per device, a streaming
 * `PACE_QUANTILE` of the log answer time of its correct answers without a hint. A correct answer
 * no slower than its pace before it is good, a slower one hard. Until the device has `PACE_MIN`
 * such answers the pace of every device applies, and before that one has them every correct
 * answer is good.
 */
export type Pace = { readonly level: number; readonly count: number };

/** A pace the fold updates in place. */
export type LivePace = { level: number; count: number };

/** The tasks whose correct answers are graded by time (ADR 100, point 4). */
export type TimedTask = 'recall' | 'build' | 'fluency' | 'dictation';

export function isTimed(task: TaskKind): task is TimedTask {
  return task === 'recall' || task === 'build' || task === 'fluency' || task === 'dictation';
}

/** The key of the pace of every device for `task`. */
export function allDevices(task: TimedTask): string {
  return task;
}

/** The key of the pace of one device for `task`. */
export function oneDevice(task: TimedTask, dev: string): string {
  return `${task}:${dev}`;
}

/** The log time an answer counts as. */
export function logMs(ms: number): number {
  return Math.log(Math.max(1, ms));
}

/** The line in ms of an answer given its device's pace and the pace of every device. */
export function lineOf(own: Pace | undefined, all: Pace | undefined): number {
  if (own !== undefined && own.count >= PACE_MIN) return Math.exp(own.level);
  if (all !== undefined && all.count >= PACE_MIN) return Math.exp(all.level);
  return Number.POSITIVE_INFINITY;
}

/** Takes a log time into a pace. */
export function notePace(pace: LivePace, x: number): void {
  if (pace.count === 0) pace.level = x;
  else pace.level += x > pace.level ? PACE_STEP * PACE_QUANTILE : -PACE_STEP * (1 - PACE_QUANTILE);
  pace.count += 1;
}

/** Whether a correct answer counts toward the pace: timed and without a hint. */
export function countsForPace(a: AnswerEvent): boolean {
  return a.ok && !a.hint && isTimed(a.task);
}
