import { kanaOf } from '@nekotype/engine';
import type { LearnKanaKey, Track } from '@nekotype/shared/types';

const SMALL = 'ぁぃぅぇぉゃゅょゎァィゥェォャュョヮ';
const FULL = 'あいうえおやゆよわアイウエオヤユヨワ';
const COMBINING_MARKS = new Set(['゙', '゚']);

export function keyOf(track: Track, kana: string): LearnKanaKey {
  return `${track}:${kana}`;
}

/** The kana of a track as keys, in track order, which is also the order of introduction. */
function trackKeys(track: Track): readonly LearnKanaKey[] {
  return kanaOf(track).map((kana) => keyOf(track, kana));
}

/** The kana of a track as keys, by track. */
const KEYS: Readonly<Record<Track, readonly LearnKanaKey[]>> = {
  hiragana: trackKeys('hiragana'),
  katakana: trackKeys('katakana'),
};

export function keysOfTrack(track: Track): readonly LearnKanaKey[] {
  return KEYS[track];
}

export function trackOfKey(key: LearnKanaKey): Track {
  return key.startsWith('hiragana:') ? 'hiragana' : 'katakana';
}

/**
 * The kana a kana depends on, derived from the table (spec learning.md, "Unlocking"): a dakuten or
 * handakuten kana depends on its base kana (Unicode canonical decomposition); a kana of two
 * characters depends on the full-size form of each character.
 */
export function dependenciesOf(track: Track, kana: string): readonly LearnKanaKey[] {
  const chars = Array.from(kana);
  let deps: string[];
  if (chars.length === 1) {
    const decomposed = Array.from(kana.normalize('NFD'));
    const [base, mark] = decomposed;
    deps =
      decomposed.length === 2 &&
      base !== undefined &&
      mark !== undefined &&
      COMBINING_MARKS.has(mark)
        ? [base]
        : [];
  } else {
    deps = chars.map((char) => {
      const at = SMALL.indexOf(char);
      return at === -1 ? char : (FULL[at] ?? char);
    });
  }
  const own = keyOf(track, kana);
  return [...new Set(deps.map((dep) => keyOf(track, dep)))].filter(
    (key) => key !== own && KEYS[track].includes(key),
  );
}
