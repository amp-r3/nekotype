import type { Script } from '../types';

// Curated pairs of visually similar kana (learning.md, "Recognition options"). Each pair is within
// one script; the lookup is symmetric.
export const similarPairs: Readonly<Record<Script, readonly (readonly [string, string])[]>> = {
  hiragana: [
    ['さ', 'ち'],
    ['さ', 'き'],
    ['ぬ', 'め'],
    ['ぬ', 'ね'],
    ['め', 'ね'],
    ['わ', 'ね'],
    ['わ', 'れ'],
    ['ね', 'れ'],
    ['る', 'ろ'],
    ['は', 'ほ'],
    ['い', 'り'],
    ['あ', 'お'],
    ['す', 'む'],
    ['た', 'な'],
    ['こ', 'に'],
    ['ま', 'よ'],
    ['ら', 'ち'],
    ['け', 'は'],
    ['ば', 'ぱ'],
    ['び', 'ぴ'],
    ['ぶ', 'ぷ'],
    ['べ', 'ぺ'],
    ['ぼ', 'ぽ'],
  ],
  katakana: [
    ['シ', 'ツ'],
    ['ソ', 'ン'],
    ['シ', 'ン'],
    ['ツ', 'ソ'],
    ['ク', 'ケ'],
    ['ク', 'タ'],
    ['ケ', 'タ'],
    ['ウ', 'ワ'],
    ['ワ', 'フ'],
    ['コ', 'ユ'],
    ['チ', 'テ'],
    ['ヌ', 'ス'],
    ['マ', 'ム'],
    ['ミ', 'ニ'],
    ['ナ', 'メ'],
    ['ノ', 'メ'],
    ['ア', 'マ'],
    ['ラ', 'ヲ'],
    ['バ', 'パ'],
    ['ビ', 'ピ'],
    ['ブ', 'プ'],
    ['ベ', 'ペ'],
    ['ボ', 'ポ'],
    ['ブ', 'ヴ'],
  ],
};

function buildIndex(): ReadonlyMap<string, readonly string[]> {
  const index = new Map<string, string[]>();
  const add = (from: string, to: string): void => {
    const list = index.get(from);
    if (list === undefined) index.set(from, [to]);
    else if (!list.includes(to)) list.push(to);
  };
  for (const pairs of [similarPairs.hiragana, similarPairs.katakana]) {
    for (const [a, b] of pairs) {
      add(a, b);
      add(b, a);
    }
  }
  return index;
}

const similarIndex = buildIndex();

/** Kana that look like `kana`, in the order of the table above; empty when there are none. */
export function similarKana(kana: string): readonly string[] {
  return similarIndex.get(kana) ?? [];
}
