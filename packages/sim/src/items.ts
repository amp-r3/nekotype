import { kanaRows, similarKana } from '@nekotype/engine';
import type { TrackRow } from '@nekotype/engine';

export type Category = TrackRow['category'];

/** A learnable kana of the simulated track. */
export interface Item {
  readonly id: number;
  readonly kana: string;
  readonly row: string;
  readonly category: Category;
  /** Ids of the kana it depends on, by the rule of learning.md ("Dependencies"). */
  readonly parts: readonly number[];
  /** Ids of the kana that look like it (the visually-similar table of the engine). */
  readonly similar: readonly number[];
  /** Characters typed for its romaji, for the answer-time model. */
  readonly keys: number;
}

const SMALL_TO_FULL: Readonly<Record<string, string>> = { ゃ: 'や', ゅ: 'ゆ', ょ: 'よ' };

function partsOf(kana: string): readonly string[] {
  const chars = Array.from(kana);
  if (chars.length > 1) return chars.map((c) => SMALL_TO_FULL[c] ?? c);
  const base = kana.normalize('NFD')[0];
  return base !== undefined && base !== kana ? [base] : [];
}

const ROMAJI_KEYS: Readonly<Record<Category, number>> = {
  basic: 2,
  dakuten: 2,
  yoon: 3,
  extended: 2,
};

/** The hiragana track in table order, which is the unlock order of the current rule. */
export function hiraganaItems(): readonly Item[] {
  const rows = kanaRows('hiragana');
  const flat = rows.flatMap((row) => row.kana.map((kana) => ({ kana, row })));
  const index = new Map(flat.map((entry, id) => [entry.kana, id]));
  const ids = (list: readonly string[]): number[] =>
    list.flatMap((kana) => {
      const id = index.get(kana);
      return id === undefined ? [] : [id];
    });
  return flat.map(({ kana, row }, id) => ({
    id,
    kana,
    row: row.id,
    category: row.category,
    parts: ids(partsOf(kana)),
    similar: ids(similarKana(kana)),
    keys:
      kana === 'ん'
        ? 1
        : ROMAJI_KEYS[row.category] - (kana.length === 1 && /[あいうえお]/u.test(kana) ? 1 : 0),
  }));
}

/** Ids of the 46 basic hiragana: the target of the pace goal. */
export function basicIds(items: readonly Item[]): readonly number[] {
  return items.filter((item) => item.category === 'basic').map((item) => item.id);
}
