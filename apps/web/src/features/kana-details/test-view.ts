import { describe, foldLog } from '@nekotype/model';
import type { LearnView } from '@nekotype/model';
import type { LearnKanaKey, LogEvent } from '@nekotype/shared/types';
import { answer, intro } from '@nekotype/model/testing';

export const KEY_A: LearnKanaKey = 'hiragana:あ';
export const KEY_I: LearnKanaKey = 'hiragana:い';
export const KEY_U: LearnKanaKey = 'hiragana:う';
export const T0 = new Date(2026, 4, 1, 12).getTime();

/** Tests only: numbers the events of one device and folds them into a view. */
export function viewOfEvents(events: readonly LogEvent[], targetMs = 1500): LearnView {
  const numbered = events.map((event, index) => ({ ...event, dev: 'd1', n: index + 1 }));
  const snapshot = foldLog(numbered, { targetMs, stats: true }).snapshot();
  if (snapshot.stats === null) throw new Error('the fold has no statistics');
  return describe(snapshot.state, snapshot.stats);
}

/**
 * あ: learned, ten fast recalls, five recognitions with three errors (い twice, え once);
 * い: introduced and not answered; う stays locked.
 */
export function sampleView(): LearnView {
  const wrongs = ['hiragana:い', 'hiragana:い', 'hiragana:え', KEY_A, KEY_A] as const;
  return viewOfEvents([
    intro(KEY_A, { at: T0 }),
    ...wrongs.map((wrong, n) =>
      answer(KEY_A, {
        at: T0 + 1000 + n * 1000,
        task: 'recognition',
        ok: wrong === KEY_A,
        wrong: wrong === KEY_A ? null : wrong,
      }),
    ),
    ...Array.from({ length: 10 }, (_, n) =>
      answer(KEY_A, { at: T0 + 100_000 + n * 40_000, ms: n < 5 ? 1000 : 800 }),
    ),
    intro(KEY_I, { at: T0 + 1_200_000 }),
  ]);
}
