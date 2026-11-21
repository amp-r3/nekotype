import { kanaRows, similarKana } from '@nekotype/engine';
import type { TrackRow } from '@nekotype/engine';

export type Category = TrackRow['category'];
export type Track = 'hiragana' | 'katakana';

/** A learnable kana of the simulated track. */
export interface Item {
  readonly id: number;
  readonly kana: string;
  readonly row: string;
  readonly category: Category;
  readonly track: Track;
  /** The same kana in the other track, when the simulation holds both. */
  readonly pair: number | undefined;
  /** Ids of the kana it depends on, by the rule of learning.md ("Dependencies"). */
  readonly parts: readonly number[];
  /** Ids of the kana that look like it (the visually-similar table of the engine). */
  readonly similar: readonly number[];
  /** Characters typed for its romaji, for the answer-time model. */
  readonly keys: number;
}

const SMALL_TO_FULL: Readonly<Record<string, string>> = {
  ゃ: 'や',
  ゅ: 'ゆ',
  ょ: 'よ',
  ャ: 'ヤ',
  ュ: 'ユ',
  ョ: 'ヨ',
  ァ: 'ア',
  ィ: 'イ',
  ゥ: 'ウ',
  ェ: 'エ',
  ォ: 'オ',
};

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

function trackItems(track: Track, offset: number): Item[] {
  const rows = kanaRows(track);
  const flat = rows.flatMap((row) => row.kana.map((kana) => ({ kana, row })));
  const index = new Map(flat.map((entry, id) => [entry.kana, id + offset]));
  const ids = (list: readonly string[]): number[] =>
    list.flatMap((kana) => {
      const id = index.get(kana);
      return id === undefined ? [] : [id];
    });
  return flat.map(({ kana, row }, i) => ({
    id: i + offset,
    kana,
    row: `${track}:${row.id}`,
    category: row.category,
    track,
    pair: undefined,
    parts: ids(partsOf(kana)),
    similar: ids(similarKana(kana)),
    keys:
      kana === 'ん' || kana === 'ン'
        ? 1
        : ROMAJI_KEYS[row.category] -
          (kana.length === 1 && /[あいうえおアイウエオ]/u.test(kana) ? 1 : 0),
  }));
}

/** A katakana written in hiragana: the code points are 0x60 apart. */
function toHiragana(kana: string): string {
  return Array.from(kana)
    .map((c) => {
      const code = c.codePointAt(0) ?? 0;
      return code >= 0x30a1 && code <= 0x30f6 ? String.fromCodePoint(code - 0x60) : c;
    })
    .join('');
}

/** The hiragana track in table order, which is the unlock order of the current rule. */
export function hiraganaItems(): readonly Item[] {
  return trackItems('hiragana', 0);
}

/** Both tracks, hiragana first; a katakana and its hiragana are each other's `pair`. */
export function bothTracks(): readonly Item[] {
  const hira = trackItems('hiragana', 0);
  const kata = trackItems('katakana', hira.length);
  const byKana = new Map(hira.map((item) => [item.kana, item.id]));
  const pairs = new Map<number, number>();
  for (const item of kata) {
    const id = byKana.get(toHiragana(item.kana));
    if (id !== undefined) {
      pairs.set(item.id, id);
      pairs.set(id, item.id);
    }
  }
  return [...hira, ...kata].map((item) => ({ ...item, pair: pairs.get(item.id) }));
}

/** Ids of the 46 basic kana of a track: the target of the pace goal. */
export function basicIds(items: readonly Item[], track: Track = 'hiragana'): readonly number[] {
  return items
    .filter((item) => item.category === 'basic' && item.track === track)
    .map((item) => item.id);
}
