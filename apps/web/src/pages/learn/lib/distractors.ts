import { kanaRows, similarKana } from '@nekotype/engine';
import type { LearnKanaKey, LearnStat, Rng, Track } from '@nekotype/shared/types';
import { isLearnKanaKey } from '@nekotype/shared/runtime';
import { keyOf, keysOfTrack } from '@/entities/learn';
import { spellingsFor } from '@/entities/prompt';
import type { Strictness } from '@/entities/prompt';
import { OPTION_COUNT } from './constants';
import { shuffled } from './shuffle';

export type OptionsInput = {
  readonly track: Track;
  /** The right answer. */
  readonly answer: LearnKanaKey;
  readonly unlocked: readonly LearnKanaKey[];
  /** The answer's recognition statistics, for its mixups. */
  readonly stat: LearnStat | undefined;
  readonly strictness: Strictness;
  readonly rng: Rng;
};

function kanaOfKey(key: LearnKanaKey): string {
  return key.slice(key.indexOf(':') + 1);
}

/** Kana of the same script that share no accepted spelling with `answer` in the strictness. */
function isDistinct(answer: LearnKanaKey, other: LearnKanaKey, strictness: Strictness): boolean {
  if (other === answer) return false;
  const own = new Set(spellingsFor(answer, strictness));
  return !spellingsFor(other, strictness).some((spelling) => own.has(spelling));
}

/**
 * Three distractors (learning.md, "Recognition options"): at most one mixup (highest count first),
 * at most one visually similar kana, then kana of the same row, then the rest of the track with
 * the unlocked ones first.
 */
export function distractorsFor(input: OptionsInput): LearnKanaKey[] {
  const { track, answer, unlocked, stat, strictness, rng } = input;
  const need = OPTION_COUNT - 1;
  const inTrack = new Set(keysOfTrack(track));
  const chosen: LearnKanaKey[] = [];
  const take = (key: LearnKanaKey): boolean => {
    if (chosen.length >= need || chosen.includes(key) || !inTrack.has(key)) return false;
    if (!isDistinct(answer, key, strictness)) return false;
    chosen.push(key);
    return true;
  };

  const order = new Map(keysOfTrack(track).map((key, index) => [key, index]));
  const mixups: [LearnKanaKey, number][] = [];
  for (const [key, count] of Object.entries(stat?.mixups ?? {})) {
    if (isLearnKanaKey(key) && inTrack.has(key)) mixups.push([key, count]);
  }
  mixups.sort((a, b) => b[1] - a[1] || (order.get(a[0]) ?? 0) - (order.get(b[0]) ?? 0));
  for (const [key] of mixups) if (take(key)) break;

  for (const kana of similarKana(kanaOfKey(answer))) if (take(keyOf(track, kana))) break;

  const row = kanaRows(track).find((candidate) => candidate.kana.includes(kanaOfKey(answer)));
  const sameRow = (row?.kana ?? []).map((kana) => keyOf(track, kana));
  for (const key of shuffled(sameRow, rng)) take(key);

  const open = new Set(unlocked);
  const rest = keysOfTrack(track);
  for (const key of rest.filter((candidate) => open.has(candidate))) take(key);
  for (const key of rest) take(key);
  return chosen;
}

/** The answer and its three distractors in a random order. */
export function recognitionOptions(input: OptionsInput): LearnKanaKey[] {
  return shuffled([input.answer, ...distractorsFor(input)], input.rng);
}
