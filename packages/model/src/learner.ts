import type { LearnKanaKey } from '@nekotype/shared/types';
import {
  DAY_MS,
  EXTRA_RECALLS_MAX,
  GOAL,
  GRADUATE,
  HORIZON_DEFAULT_MS,
  LEARN_MAX,
  PRESSURE_SPAN,
  RETENTION,
  RETENTION_MAX,
} from './constants';
import type { ModelState } from './fold';
import { intervalFactor } from './fsrs';

/** What the planner and the fold read of the state: the learner values of candidate A4. */
type Observed = Pick<ModelState, 'learner'>;

/** 0 while review retention holds the goal; 1 at 10 points below. */
export function pressure(state: Observed): number {
  return Math.min(1, Math.max(0, (GOAL - state.learner.observed) / PRESSURE_SPAN));
}

export function requestedRetention(state: Observed): number {
  return RETENTION + pressure(state) * (RETENTION_MAX - RETENTION);
}

/** Kana learning at once. */
export function learningLimit(state: Observed): number {
  return Math.max(1, Math.round(LEARN_MAX - pressure(state) * (LEARN_MAX - 1)));
}

/** Correct recalls in a row that make a kana learned. */
export function recallsToLearn(state: Observed): number {
  return GRADUATE + Math.round(EXTRA_RECALLS_MAX * pressure(state));
}

/** The median of `gaps` (the element at ⌊length / 2⌋ of the sorted list), or the default. */
export function horizonMs(state: Observed): number {
  const { gaps } = state.learner;
  if (gaps.length === 0) return HORIZON_DEFAULT_MS;
  const sorted = [...gaps].sort((a, b) => a - b);
  return sorted[Math.floor(sorted.length / 2)] ?? HORIZON_DEFAULT_MS;
}

/** A learned kana: the moment from which it is due; null otherwise. */
export function dueFrom(state: ModelState, key: LearnKanaKey): number | null {
  const item = state.items.get(key);
  if (item?.phase !== 'learned') return null;
  const days = item.memory.stability * intervalFactor(requestedRetention(state));
  return item.lastAt + days * DAY_MS - horizonMs(state);
}
