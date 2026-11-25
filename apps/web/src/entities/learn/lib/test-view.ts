import { describe as describeState, foldLog } from '@nekotype/model';
import type { LearnView } from '@nekotype/model';
import { answer, intro, start } from '@nekotype/model/testing';
import type { LearnKanaKey, LogEvent } from '@nekotype/shared/types';

/** Tests only: numbers the events 1, 2, 3, … of one device and folds them into a view. */
export function viewOfEvents(events: readonly LogEvent[]): LearnView {
  const numbered = events.map((event, index) => ({ ...event, dev: 'd1', n: index + 1 }));
  const snapshot = foldLog(numbered, { stats: true }).snapshot();
  if (snapshot.stats === null) throw new Error('the fold has no statistics');
  return describeState(snapshot.state, snapshot.stats);
}

/** An introduction and five fast, correct recalls 40 s apart: the kana is learned at the end. */
export function learnedEvents(key: LearnKanaKey, at: number): LogEvent[] {
  return [
    intro(key, { at }),
    ...Array.from({ length: 5 }, (_, i) => answer(key, { at: at + 40_000 * (i + 1), ms: 900 })),
  ];
}

export { answer, intro, start };
