import type { LearnKanaKey, LearnState, Rng, Track } from '@nekotype/shared/types';
import { RECENT_ANSWERS } from '@nekotype/shared/runtime';
import { accuracyOf, isConfident, medianAnswerMs } from '@/entities/learn';
import { FOCUS_ANSWERS, FOCUS_SHARE, RECOGNITION_SHARE } from './constants';

export type TaskKind = 'recall' | 'recognition';

export type ChosenTask = {
  readonly key: LearnKanaKey;
  readonly kind: TaskKind;
};

export type TaskChoiceInput = {
  readonly track: Track;
  readonly state: LearnState;
  readonly targetMs: number;
  /** The kana of the previous task; left out when another kana is available. */
  readonly previous: LearnKanaKey | null;
  readonly rng: Rng;
};

function clamp01(value: number): number {
  return Math.min(1, Math.max(0, value));
}

/**
 * The weight of a kana out of focus (learning.md, "Learning session"): 1 for a confident kana
 * without errors, up to 5 for one twice as slow as the target or wrong in half its answers.
 */
export function kanaWeight(state: LearnState, key: LearnKanaKey, targetMs: number): number {
  const answers = state.recent[key] ?? [];
  const slow = clamp01((medianAnswerMs(answers) - targetMs) / targetMs);
  const err = clamp01((1 - accuracyOf(answers)) / 0.5);
  return 1 + 4 * Math.min(1, slow + err);
}

/** Introduced and unlocked kana of the track: the ones a task can take. */
export function candidatesOf(state: LearnState, track: Track): readonly LearnKanaKey[] {
  return state.unlocked[track].filter((key) => state.entries[key] !== undefined);
}

function pickUniform(keys: readonly LearnKanaKey[], rng: Rng): LearnKanaKey | null {
  if (keys.length === 0) return null;
  return keys[Math.min(keys.length - 1, Math.floor(rng.next() * keys.length))] ?? null;
}

function pickWeighted(
  keys: readonly LearnKanaKey[],
  weight: (key: LearnKanaKey) => number,
  rng: Rng,
): LearnKanaKey | null {
  let total = 0;
  for (const key of keys) total += weight(key);
  let threshold = rng.next() * total;
  for (const key of keys) {
    const w = weight(key);
    if (threshold < w) return key;
    threshold -= w;
  }
  return keys[keys.length - 1] ?? null;
}

/**
 * The kana of the next task, or `null` when none is introduced. Kana in focus (fewer than 10
 * recall answers, or not confident: ADR 063) are taken with probability `FOCUS_SHARE` when there are kana both in and out of
 * focus, always when all are in focus, never when none is (A40).
 */
export function chooseKana(input: TaskChoiceInput): LearnKanaKey | null {
  const { state, track, targetMs, previous, rng } = input;
  const all = candidatesOf(state, track);
  const others = all.filter((key) => key !== previous);
  const candidates = others.length > 0 ? others : all;
  const inFocus = candidates.filter((key) => {
    const recent = state.recent[key] ?? [];
    return (
      recent.length < Math.min(FOCUS_ANSWERS, RECENT_ANSWERS) || !isConfident(recent, targetMs)
    );
  });
  const outOfFocus = candidates.filter((key) => !inFocus.includes(key));
  const takeFocus = inFocus.length > 0 && (outOfFocus.length === 0 || rng.next() < FOCUS_SHARE);
  if (takeFocus) return pickUniform(inFocus, rng);
  return pickWeighted(outOfFocus, (key) => kanaWeight(state, key, targetMs), rng);
}

/** The next task: a kana and a task type (recognition with probability `RECOGNITION_SHARE`). */
export function chooseTask(input: TaskChoiceInput): ChosenTask | null {
  const key = chooseKana(input);
  if (key === null) return null;
  return { key, kind: input.rng.next() < RECOGNITION_SHARE ? 'recognition' : 'recall' };
}
