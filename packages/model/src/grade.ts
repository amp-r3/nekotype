import type { AnswerEvent, LearnKanaKey } from '@nekotype/shared/types';
import type { Grade } from './fsrs';
import { ITEMS, isWordKey, kanaOfReading } from './items';
import type { KanaItem } from './items';

export type { Grade } from './fsrs';

export type Effect =
  /** A memory update. `main`: the kana the task asked, whose phase and streak follow it. */
  | {
      readonly kind: 'grade';
      readonly key: LearnKanaKey;
      readonly grade: Grade;
      readonly main: boolean;
    }
  /** A confusion count of the ordered pair (asked, given), raised or lowered by one, never below 0. */
  | {
      readonly kind: 'confusion';
      readonly asked: LearnKanaKey;
      readonly given: LearnKanaKey;
      readonly delta: 1 | -1;
    };

/**
 * Receives the effects of one answer in the order of `effectsOf`, and says whether a kana is
 * learned at that point.
 */
export interface EffectSink {
  grade(key: LearnKanaKey, grade: Grade, main: boolean): void;
  confusion(asked: LearnKanaKey, given: LearnKanaKey, delta: 1 | -1): void;
  learned(key: LearnKanaKey): boolean;
}

/**
 * The effects of `effectsOf`, in its order, given to `sink` one at a time: the fold applies them
 * without a list per answer. Each `sink.learned` call comes after the effects before it are applied; no
 * effect changes the answer it reads (a credit, a pair or a word's kana is never the kana asked, and
 * only the main grade moves a phase), so the result is the one of `effectsOf`. `item`: the entry
 * of `answer.k` in `ITEMS`, which the fold has already looked up. Not part of the package's index.
 */
export function eachEffect(
  answer: AnswerEvent,
  line: number,
  sink: EffectSink,
  item: KanaItem | undefined,
): void {
  const { k, ok, task } = answer;
  if (isWordKey(k)) {
    if (task !== 'word' || !ok) return;
    for (const key of kanaOfReading(k.slice('word:'.length))) {
      if (sink.learned(key)) sink.grade(key, 2, false);
    }
    return;
  }

  if (!ok) {
    switch (task) {
      case 'recall':
      case 'recognition':
      case 'listening':
        sink.grade(k, 1, true);
        if (answer.wrong !== null) sink.confusion(k, answer.wrong, 1);
        return;
      case 'contrast':
      case 'pair':
        sink.grade(k, 1, true);
        if (answer.alt !== null) sink.confusion(k, answer.alt, 1);
        return;
      case 'word':
        return;
      case 'transfer':
      case 'build':
      case 'fluency':
      case 'dictation':
        sink.grade(k, 1, true);
        return;
    }
  }

  const byTime: Grade = answer.ms <= line && !answer.hint ? 3 : 2;
  switch (task) {
    case 'recall':
    case 'build': {
      sink.grade(k, byTime, true);
      // Credit: the learned parts.
      const parts = item?.parts;
      if (parts !== undefined)
        for (const key of parts) if (sink.learned(key)) sink.grade(key, 2, false);
      return;
    }
    case 'recognition':
    case 'listening':
      sink.grade(k, 2, true);
      if (answer.wrong !== null) sink.confusion(k, answer.wrong, 1);
      return;
    case 'contrast':
      sink.grade(k, 2, true);
      if (answer.alt !== null) sink.confusion(k, answer.alt, -1);
      return;
    case 'pair':
      sink.grade(k, 2, true);
      return;
    case 'transfer': {
      sink.grade(k, 2, true);
      const pair = item?.pair ?? null;
      if (pair !== null && sink.learned(pair)) sink.grade(pair, 2, false);
      return;
    }
    case 'fluency':
      if (answer.ms <= line) sink.grade(k, 3, true);
      return;
    case 'dictation':
      sink.grade(k, byTime, true);
      return;
    case 'word':
      return;
  }
}

/**
 * The memory updates and confusion changes of one answer: the table of ADR 100, point 4. A
 * grade is computed when the log is folded and is never stored. `learned`: whether a kana is
 * learned at this point of the fold.
 *
 * "By time" is good (3) when `ms <= line` and no hint, else hard (2). `line` is the answer's
 * pace in ms (ADR 115), which the fold works out; Infinity for a task not graded by time. A wrong answer is
 * "again" (1) on the kana asked. Credit and pair reviews are `main: false`.
 */
export function effectsOf(
  answer: AnswerEvent,
  line: number,
  learned: (key: LearnKanaKey) => boolean,
): readonly Effect[] {
  const effects: Effect[] = [];
  const item = isWordKey(answer.k) ? undefined : ITEMS.get(answer.k);
  eachEffect(
    answer,
    line,
    {
      grade(key, grade, main) {
        effects.push({ kind: 'grade', key, grade, main });
      },
      confusion(asked, given, delta) {
        effects.push({ kind: 'confusion', asked, given, delta });
      },
      learned,
    },
    item,
  );
  return effects;
}
