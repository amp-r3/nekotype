import type { LearnKanaKey, TaskKind } from '@nekotype/shared/types';
import { describe, expect, it } from 'vitest';
import { effectsOf } from './grade';
import type { Effect } from './grade';
import { answer } from './testing';

const LINE = 1500;
const all = (): boolean => true;
const none = (): boolean => false;
const only =
  (...keys: LearnKanaKey[]) =>
  (key: LearnKanaKey): boolean =>
    keys.includes(key);

const grade = (key: LearnKanaKey, g: 1 | 2 | 3 | 4, main = true): Effect => ({
  kind: 'grade',
  key,
  grade: g,
  main,
});
const confusion = (asked: LearnKanaKey, given: LearnKanaKey, delta: 1 | -1): Effect => ({
  kind: 'confusion',
  asked,
  given,
  delta,
});

const GA = 'hiragana:が';
const KA = 'hiragana:か';
const KYA = 'hiragana:きゃ';
const KI = 'hiragana:き';
const YA = 'hiragana:や';
const SA = 'hiragana:さ';

describe('grades by task type (ADR 100, point 4)', () => {
  describe('recall', () => {
    it('is good within its line and hard after it', () => {
      expect(effectsOf(answer(KA, { ms: LINE }), LINE, none)).toEqual([grade(KA, 3)]);
      expect(effectsOf(answer(KA, { ms: LINE + 1 }), LINE, none)).toEqual([grade(KA, 2)]);
    });
    it('is hard when a hint was used', () => {
      expect(effectsOf(answer(KA, { ms: 500, hint: true }), LINE, none)).toEqual([grade(KA, 2)]);
    });
    it('credits only the learned parts, hard and not main', () => {
      expect(effectsOf(answer(KYA), LINE, only(KI))).toEqual([grade(KYA, 3), grade(KI, 2, false)]);
      expect(effectsOf(answer(KYA), LINE, all)).toEqual([
        grade(KYA, 3),
        grade(KI, 2, false),
        grade(YA, 2, false),
      ]);
      expect(effectsOf(answer(KYA), LINE, none)).toEqual([grade(KYA, 3)]);
    });
    it('is again when wrong, with a confusion when the wrong kana is known', () => {
      expect(effectsOf(answer(KA, { ok: false, wrong: SA }), LINE, all)).toEqual([
        grade(KA, 1),
        confusion(KA, SA, 1),
      ]);
      expect(effectsOf(answer(KA, { ok: false }), LINE, all)).toEqual([grade(KA, 1)]);
    });
  });

  describe('recognition and listening', () => {
    for (const task of ['recognition', 'listening'] as const) {
      it(`${task} is hard when correct and again when wrong, with confusions`, () => {
        expect(effectsOf(answer(KA, { task, ms: 100 }), LINE, all)).toEqual([grade(KA, 2)]);
        expect(effectsOf(answer(KA, { task, ok: false, wrong: SA }), LINE, all)).toEqual([
          grade(KA, 1),
          confusion(KA, SA, 1),
        ]);
        expect(effectsOf(answer(KA, { task, ok: false }), LINE, all)).toEqual([grade(KA, 1)]);
      });
    }
  });

  describe('contrast', () => {
    it('is hard and lowers the confusion with the other option when correct', () => {
      expect(effectsOf(answer(KA, { task: 'contrast', alt: GA }), LINE, all)).toEqual([
        grade(KA, 2),
        confusion(KA, GA, -1),
      ]);
    });
    it('is again and raises it when wrong', () => {
      expect(
        effectsOf(answer(KA, { task: 'contrast', ok: false, alt: GA, wrong: GA }), LINE, all),
      ).toEqual([grade(KA, 1), confusion(KA, GA, 1)]);
    });
    it('has no confusion without the other option', () => {
      expect(effectsOf(answer(KA, { task: 'contrast' }), LINE, all)).toEqual([grade(KA, 2)]);
    });
  });

  describe('transfer', () => {
    it('is hard, and hard for the pair when it is learned', () => {
      expect(effectsOf(answer('katakana:カ', { task: 'transfer' }), LINE, only(KA))).toEqual([
        grade('katakana:カ', 2),
        grade(KA, 2, false),
      ]);
      expect(effectsOf(answer('katakana:カ', { task: 'transfer' }), LINE, none)).toEqual([
        grade('katakana:カ', 2),
      ]);
      expect(effectsOf(answer('katakana:ヴ', { task: 'transfer' }), LINE, all)).toEqual([
        grade('katakana:ヴ', 2),
      ]);
    });
    it('is again when wrong and has no confusion', () => {
      expect(
        effectsOf(answer('katakana:カ', { task: 'transfer', ok: false, wrong: SA }), LINE, all),
      ).toEqual([grade('katakana:カ', 1)]);
    });
  });

  describe('build', () => {
    it('is by time and credits the learned parts', () => {
      expect(effectsOf(answer(GA, { task: 'build', ms: 900 }), LINE, all)).toEqual([
        grade(GA, 3),
        grade(KA, 2, false),
      ]);
      expect(effectsOf(answer(GA, { task: 'build', ms: 9000 }), LINE, none)).toEqual([
        grade(GA, 2),
      ]);
    });
    it('is again when wrong, with no confusion and no credit', () => {
      expect(effectsOf(answer(GA, { task: 'build', ok: false, wrong: KA }), LINE, all)).toEqual([
        grade(GA, 1),
      ]);
    });
  });

  describe('fluency', () => {
    it('is good within its line and has no effect when slower', () => {
      expect(effectsOf(answer(KA, { task: 'fluency', ms: LINE }), LINE, all)).toEqual([
        grade(KA, 3),
      ]);
      expect(effectsOf(answer(KA, { task: 'fluency', ms: LINE + 1 }), LINE, all)).toEqual([]);
    });
    it('is again when wrong', () => {
      expect(effectsOf(answer(KA, { task: 'fluency', ok: false }), LINE, all)).toEqual([
        grade(KA, 1),
      ]);
    });
  });

  describe('dictation', () => {
    it('is by time, again when wrong', () => {
      expect(effectsOf(answer(KA, { task: 'dictation', ms: 100 }), LINE, all)).toEqual([
        grade(KA, 3),
      ]);
      expect(effectsOf(answer(KA, { task: 'dictation', ms: 5000 }), LINE, all)).toEqual([
        grade(KA, 2),
      ]);
      expect(effectsOf(answer(KA, { task: 'dictation', ok: false, wrong: SA }), LINE, all)).toEqual(
        [grade(KA, 1)],
      );
    });
  });

  describe('pair', () => {
    it('is hard when correct, again with a confusion when wrong', () => {
      expect(effectsOf(answer(KA, { task: 'pair', alt: GA }), LINE, all)).toEqual([grade(KA, 2)]);
      expect(effectsOf(answer(KA, { task: 'pair', ok: false, alt: GA }), LINE, all)).toEqual([
        grade(KA, 1),
        confusion(KA, GA, 1),
      ]);
    });
  });

  describe('word', () => {
    it('is hard for each learned kana of the reading, in order', () => {
      expect(
        effectsOf(
          answer('word:きょうと', { task: 'word' }),
          LINE,
          only('hiragana:きょ', 'hiragana:と'),
        ),
      ).toEqual([grade('hiragana:きょ', 2, false), grade('hiragana:と', 2, false)]);
    });
    it('has no effect when wrong', () => {
      expect(effectsOf(answer('word:きょうと', { task: 'word', ok: false }), LINE, all)).toEqual(
        [],
      );
    });
    it('has no effect when the task is not a word', () => {
      expect(effectsOf(answer('word:きょうと', { task: 'recall' }), LINE, all)).toEqual([]);
    });
  });

  describe('a task of format 4 without a grade yet, and a rule', () => {
    it('has no effect, wrong or right', () => {
      for (const ok of [true, false]) {
        for (const task of ['mismatch', 'script'] as const) {
          expect(effectsOf(answer(KA, { task, ok, wrong: SA, alt: GA }), LINE, all)).toEqual([]);
        }
        expect(effectsOf(answer('rule:sokuon', { task: 'word', ok }), LINE, all)).toEqual([]);
      }
    });
  });

  it('never gives easy', () => {
    const tasks: TaskKind[] = [
      'recall',
      'recognition',
      'contrast',
      'transfer',
      'build',
      'fluency',
      'listening',
      'dictation',
      'pair',
    ];
    for (const task of tasks) {
      for (const ok of [true, false]) {
        for (const effect of effectsOf(answer(KYA, { task, ok, ms: 1, alt: GA }), LINE, all)) {
          if (effect.kind === 'grade') expect(effect.grade).not.toBe(4);
        }
      }
    }
  });
});
