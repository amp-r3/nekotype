import type { LearnKanaKey, LearnState, Track } from '@nekotype/shared/types';
import { RECENT_ANSWERS } from '@nekotype/shared/runtime';
import { isConfident, medianAnswerMs } from '@/entities/learn';

/** Changes in the median answer time smaller than this are not listed. */
export const CHANGE_MIN_MS = 100;
/** At most this many faster and this many slower kana are listed. */
export const CHANGE_LIMIT = 5;

export type MedianChange = {
  readonly key: LearnKanaKey;
  readonly from: number;
  readonly to: number;
};

export type Mixup = {
  /** The right answer. */
  readonly key: LearnKanaKey;
  /** The kana picked instead of it. */
  readonly chosen: LearnKanaKey;
};

export type SessionSummary = {
  readonly unlocked: readonly LearnKanaKey[];
  readonly confident: readonly LearnKanaKey[];
  readonly faster: readonly MedianChange[];
  readonly slower: readonly MedianChange[];
  /** Recognition: a kana picked instead of the right one. */
  readonly mixups: readonly Mixup[];
  /** Recall: kana typed with errors. */
  readonly errors: readonly LearnKanaKey[];
};

export type SummaryInput = {
  readonly track: Track;
  /** The learning state when the session started and when it ended. */
  readonly before: LearnState;
  readonly after: LearnState;
  readonly targetMs: number;
  readonly mixups: readonly Mixup[];
  readonly errors: readonly LearnKanaKey[];
};

/** Whether the summary has nothing to list. */
export function isEmptySummary(summary: SessionSummary): boolean {
  return (
    summary.unlocked.length === 0 &&
    summary.confident.length === 0 &&
    summary.faster.length === 0 &&
    summary.slower.length === 0 &&
    summary.mixups.length === 0 &&
    summary.errors.length === 0
  );
}

/** What the session changed (learning.md, "Session summary"). */
export function summarize(input: SummaryInput): SessionSummary {
  const { track, before, after, targetMs } = input;
  const unlockedBefore = new Set(before.unlocked[track]);
  const unlocked = after.unlocked[track].filter((key) => !unlockedBefore.has(key));

  const confident: LearnKanaKey[] = [];
  const changes: MedianChange[] = [];
  for (const key of after.unlocked[track]) {
    const was = before.recent[key] ?? [];
    const now = after.recent[key] ?? [];
    if (!isConfident(was, targetMs) && isConfident(now, targetMs)) confident.push(key);
    if (was.length >= RECENT_ANSWERS) {
      changes.push({ key, from: medianAnswerMs(was), to: medianAnswerMs(now) });
    }
  }
  const delta = (change: MedianChange): number => change.to - change.from;
  const faster = changes
    .filter((change) => delta(change) <= -CHANGE_MIN_MS)
    .sort((a, b) => delta(a) - delta(b))
    .slice(0, CHANGE_LIMIT);
  const slower = changes
    .filter((change) => delta(change) >= CHANGE_MIN_MS)
    .sort((a, b) => delta(b) - delta(a))
    .slice(0, CHANGE_LIMIT);

  return {
    unlocked,
    confident,
    faster,
    slower,
    mixups: input.mixups,
    errors: input.errors,
  };
}
