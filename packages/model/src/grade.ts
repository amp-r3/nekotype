import type { AnswerEvent, LearnKanaKey } from '@nekotype/shared/types';
import type { Grade } from './fsrs';
import { ITEMS, isWordKey, kanaOfReading } from './items';

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
 * The memory updates and confusion changes of one answer: the table of ADR 100, point 4. A
 * grade is computed when the log is folded and is never stored. `learned`: whether a kana is
 * learned at this point of the fold.
 *
 * "By time" is good (3) when `ms <= targetMs` and no hint, else hard (2). A wrong answer is
 * "again" (1) on the kana asked. Credit and pair reviews are `main: false`.
 */
export function effectsOf(
  answer: AnswerEvent,
  targetMs: number,
  learned: (key: LearnKanaKey) => boolean,
): readonly Effect[] {
  const { k, ok, task } = answer;
  if (isWordKey(k)) {
    if (task !== 'word' || !ok) return [];
    return kanaOfReading(k.slice('word:'.length))
      .filter(learned)
      .map((key) => ({ kind: 'grade', key, grade: 2, main: false }));
  }

  const grade = (g: Grade): Effect => ({ kind: 'grade', key: k, grade: g, main: true });
  const credit = (): Effect[] =>
    (ITEMS.get(k)?.parts ?? [])
      .filter(learned)
      .map((key) => ({ kind: 'grade', key, grade: 2, main: false }));
  const confusion = (given: LearnKanaKey | null, delta: 1 | -1): Effect[] =>
    given === null ? [] : [{ kind: 'confusion', asked: k, given, delta }];
  const byTime: Grade = answer.ms <= targetMs && !answer.hint ? 3 : 2;

  if (!ok) {
    switch (task) {
      case 'recall':
      case 'recognition':
      case 'listening':
        return [grade(1), ...confusion(answer.wrong, 1)];
      case 'contrast':
      case 'pair':
        return [grade(1), ...confusion(answer.alt, 1)];
      case 'word':
        return [];
      case 'transfer':
      case 'build':
      case 'fluency':
      case 'dictation':
        return [grade(1)];
    }
  }

  switch (task) {
    case 'recall':
      return [grade(byTime), ...credit()];
    case 'build':
      return [grade(byTime), ...credit()];
    case 'recognition':
    case 'listening':
      return [grade(2), ...confusion(answer.wrong, 1)];
    case 'contrast':
      return [grade(2), ...confusion(answer.alt, -1)];
    case 'pair':
      return [grade(2)];
    case 'transfer': {
      const pair = ITEMS.get(k)?.pair ?? null;
      const effects = [grade(2)];
      if (pair !== null && learned(pair)) {
        effects.push({ kind: 'grade', key: pair, grade: 2, main: false });
      }
      return effects;
    }
    case 'fluency':
      return answer.ms <= targetMs ? [grade(3)] : [];
    case 'dictation':
      return [grade(byTime)];
    case 'word':
      return [];
  }
}
