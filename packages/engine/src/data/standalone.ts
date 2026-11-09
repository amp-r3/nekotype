import type { StandaloneRow } from '../types';
import { standaloneOf } from './notation';

// Small kana, ゐ and ゑ (spec D7). They are typed as standalone tokens, belong to no selectable
// row and are not part of `allKanaRows`. ゕ and ゖ are not supported, so ヵ and ヶ are katakana only.
// Each kana has the same spellings in both modes, canonical (x-form) first. See notation.ts for how
// an entry is written.
export const standaloneRows: readonly StandaloneRow[] = [
  standaloneOf(
    'small',
    'ぁァ xa,la|ぃィ xi,li|ぅゥ xu,lu|ぇェ xe,le|ぉォ xo,lo|ゃャ xya,lya|ゅュ xyu,lyu|ょョ xyo,lyo|ゎヮ xwa,lwa|ヵ xka,lka|ヶ xke,lke',
  ),
  standaloneOf('archaic', 'ゐヰ wyi|ゑヱ wye'),
];
