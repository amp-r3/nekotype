import type { LearnView } from '@nekotype/model';
import type { LearnKanaKey } from '@nekotype/shared/types';

/** Changes in the median answer time smaller than this are not listed. */
export const CHANGE_MIN_MS = 100;
/** At most this many faster and this many slower kana are listed. */
export const CHANGE_LIMIT = 5;
/**
 * The window of recent recalls behind `LearnView.recall` (`RECENT_RECALLS` of `@nekotype/model`,
 * not imported: the model is a lazy chunk and this module is not).
 */
export const RECALL_WINDOW = 10;

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
  /** Kana introduced in the session. */
  readonly introduced: readonly LearnKanaKey[];
  /** Kana that were locked or learning at the start and are learned or mastered now. */
  readonly learned: readonly LearnKanaKey[];
  readonly faster: readonly MedianChange[];
  readonly slower: readonly MedianChange[];
  /** Recognition: a kana picked instead of the right one. */
  readonly mixups: readonly Mixup[];
  /** Recall: kana typed with errors. */
  readonly errors: readonly LearnKanaKey[];
};

export type SummaryInput = {
  /** The view when the session started and when it ended. */
  readonly before: LearnView;
  readonly after: LearnView;
  readonly mixups: readonly Mixup[];
  readonly errors: readonly LearnKanaKey[];
};

/** Whether the summary has nothing to list. */
export function isEmptySummary(summary: SessionSummary): boolean {
  return (
    summary.introduced.length === 0 &&
    summary.learned.length === 0 &&
    summary.faster.length === 0 &&
    summary.slower.length === 0 &&
    summary.mixups.length === 0 &&
    summary.errors.length === 0
  );
}

/** What the session changed (learning.md, "Session summary"), kana of both tracks. */
export function summarize(input: SummaryInput): SessionSummary {
  const { before, after } = input;
  const introduced: LearnKanaKey[] = [];
  const learned: LearnKanaKey[] = [];
  const changes: MedianChange[] = [];
  for (const [key, now] of after.kana) {
    const was = before.kana.get(key);
    if (was === undefined) continue;
    if (was.state === 'locked' && now.state !== 'locked') introduced.push(key);
    const known = now.state === 'learned' || now.state === 'mastered';
    if ((was.state === 'locked' || was.state === 'learning') && known) learned.push(key);
    if (was.recall.length >= RECALL_WINDOW) {
      changes.push({ key, from: was.medianMs, to: now.medianMs });
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

  return { introduced, learned, faster, slower, mixups: input.mixups, errors: input.errors };
}
