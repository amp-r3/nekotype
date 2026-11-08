import type { RecallAnswer } from '@nekotype/shared/types';
import { RECENT_ANSWERS } from '@nekotype/shared/runtime';
import { median } from './answer-time';

/** Accuracy needed for confidence. */
export const CONFIDENT_ACCURACY = 0.9;

/** The median answer time of the recall answers; 0 when there are none. */
export function medianAnswerMs(answers: readonly RecallAnswer[]): number {
  return median(answers.map((answer) => answer.ms));
}

/** Correct answers / answers; 1 when there are none. */
export function accuracyOf(answers: readonly RecallAnswer[]): number {
  if (answers.length === 0) return 1;
  return answers.filter((answer) => answer.ok).length / answers.length;
}

/**
 * Confident: 10 recall answers, a median answer time of at most the target and an accuracy of at
 * least 90%. Derived from the stored answers, never stored itself.
 */
export function isConfident(answers: readonly RecallAnswer[], targetMs: number): boolean {
  if (answers.length < RECENT_ANSWERS) return false;
  return medianAnswerMs(answers) <= targetMs && accuracyOf(answers) >= CONFIDENT_ACCURACY;
}
