import { kanaRows, similarKana } from '@nekotype/engine';
import type { LearnKanaKey, Rng, Track } from '@nekotype/shared/types';
import { keyOf, keysOfTrack } from '@/entities/learn';
import { spellingsFor } from './prompt';
import type { Strictness } from './prompt';
import { OPTION_COUNT } from './constants';
import { shuffled } from './shuffle';

export type OptionsInput = {
  readonly track: Track;
  /** The right answer. */
  readonly answer: LearnKanaKey;
  /** Kana of the track that are introduced; they come before the rest as filler. */
  readonly introduced: readonly LearnKanaKey[];
  /** Kana given instead of the answer, most first (`KanaView.confusions`). */
  readonly confusions: readonly { readonly key: LearnKanaKey; readonly count: number }[];
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
 * Three distractors (learning.md, "Recognition options"): at most one confusion (highest count first),
 * at most one visually similar kana, then kana of the same row, then the rest of the track with
 * the introduced ones first.
 */
export function distractorsFor(input: OptionsInput): LearnKanaKey[] {
  const { track, answer, introduced, confusions, strictness, rng } = input;
  const need = OPTION_COUNT - 1;
  const inTrack = new Set(keysOfTrack(track));
  const chosen: LearnKanaKey[] = [];
  const take = (key: LearnKanaKey): boolean => {
    if (chosen.length >= need || chosen.includes(key) || !inTrack.has(key)) return false;
    if (!isDistinct(answer, key, strictness)) return false;
    chosen.push(key);
    return true;
  };

  for (const { key } of confusions) if (take(key)) break;

  for (const kana of similarKana(kanaOfKey(answer))) if (take(keyOf(track, kana))) break;

  const row = kanaRows(track).find((candidate) => candidate.kana.includes(kanaOfKey(answer)));
  const sameRow = (row?.kana ?? []).map((kana) => keyOf(track, kana));
  for (const key of shuffled(sameRow, rng)) take(key);

  const open = new Set(introduced);
  const rest = keysOfTrack(track);
  for (const key of rest.filter((candidate) => open.has(candidate))) take(key);
  for (const key of rest) take(key);
  return chosen;
}

/** The answer and its three distractors in a random order. */
export function recognitionOptions(input: OptionsInput): LearnKanaKey[] {
  return shuffled([input.answer, ...distractorsFor(input)], input.rng);
}
