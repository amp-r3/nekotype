import type { LearnKanaKey, Track } from '@nekotype/shared/types';
import { keysOfTrack } from '@/entities/learn';
import { spellingsFor } from './prompt';
import type { Strictness } from './prompt';

const maps = new Map<string, ReadonlyMap<string, LearnKanaKey | null>>();

/** Spelling → its kana, or null when more than one kana of the track accepts it. */
function spellingMap(
  track: Track,
  strictness: Strictness,
): ReadonlyMap<string, LearnKanaKey | null> {
  const id = `${track}:${strictness}`;
  const known = maps.get(id);
  if (known !== undefined) return known;
  const built = new Map<string, LearnKanaKey | null>();
  for (const key of keysOfTrack(track)) {
    for (const spelling of spellingsFor(key, strictness)) {
      built.set(spelling, built.has(spelling) ? null : key);
    }
  }
  maps.set(id, built);
  return built;
}

/**
 * The kana that a typed romaji matched (P7 plan, D18): the accepted prefix plus the first rejected
 * key, when it is exactly one spelling of exactly one kana of the track in the strictness; else
 * null. し typed `su` gives す; か typed `g` gives null; ぢ in relaxed `ji` is two kana, so null.
 */
export function wrongKana(
  track: Track,
  strictness: Strictness,
  typed: string,
): LearnKanaKey | null {
  return spellingMap(track, strictness).get(typed) ?? null;
}
