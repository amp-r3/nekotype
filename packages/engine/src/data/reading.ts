import type { Script } from '../types';
import { allKanaRows } from './tables';

// A token of a word's reading as it is read, not as it is typed: っ never merges (P9, D5).
export type ReadingToken =
  | { readonly kind: 'kana'; readonly kana: string; readonly script: Script }
  | { readonly kind: 'sokuon' } // っ or ッ
  | { readonly kind: 'choon' }; // ー

const SCRIPT_BY_KANA: ReadonlyMap<string, Script> = /* @__PURE__ */ new Map(
  allKanaRows.flatMap((row) =>
    row.entries.flatMap((e): [string, Script][] => [
      ...(e.hiragana === undefined ? [] : [[e.hiragana, 'hiragana'] satisfies [string, Script]]),
      [e.katakana, 'katakana'],
    ]),
  ),
);

// The tokens of a reading, longest kana of the selectable rows first; null when a character is none.
export function readingTokens(text: string): readonly ReadingToken[] | null {
  const out: ReadingToken[] = [];
  let i = 0;
  while (i < text.length) {
    // The longest kana of the rows is two characters: a yōon or an extended katakana.
    const pair = text.slice(i, i + 2);
    const kana = SCRIPT_BY_KANA.has(pair) ? pair : text.charAt(i);
    const script = SCRIPT_BY_KANA.get(kana);
    if (script !== undefined) out.push({ kind: 'kana', kana, script });
    else if (kana === 'っ' || kana === 'ッ') out.push({ kind: 'sokuon' });
    else if (kana === 'ー') out.push({ kind: 'choon' });
    else return null;
    i += kana.length;
  }
  return out;
}
