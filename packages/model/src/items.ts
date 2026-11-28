import { kanaRows } from '@nekotype/engine';
import type { RowCategory } from '@nekotype/engine';
import type { LearnKanaKey, Track, WordKey, RuleKey } from '@nekotype/shared/types';

export type RowId = `${Track}:${string}`; // `${track}:${row id of the kana table}`, e.g. 'hiragana:k'

export type KanaItem = {
  readonly key: LearnKanaKey;
  readonly kana: string;
  readonly track: Track;
  readonly row: RowId;
  readonly category: RowCategory;
  /** Position in track order, from 0. */
  readonly index: number;
  /** The kana it is built from ([Learning](docs/spec/learning.md#unlocking), "Dependencies"). */
  readonly parts: readonly LearnKanaKey[];
  /** The same kana in the other track, when there is one. */
  readonly pair: LearnKanaKey | null;
};

const SMALL = 'ぁぃぅぇぉゃゅょゎァィゥェォャュョヮ';
const FULL = 'あいうえおやゆよわアイウエオヤユヨワ';
const COMBINING_MARKS = new Set(['゙', '゚']);

function keyOf(track: Track, kana: string): LearnKanaKey {
  return `${track}:${kana}`;
}

/** The kana a kana is built from: its base before a (han)dakuten mark, the full-size form of each character of a yoon. */
function partsOf(track: Track, kana: string, own: ReadonlySet<LearnKanaKey>): LearnKanaKey[] {
  const chars = Array.from(kana);
  let parts: string[];
  if (chars.length === 1) {
    const [base, mark, ...rest] = Array.from(kana.normalize('NFD'));
    parts =
      base !== undefined && mark !== undefined && rest.length === 0 && COMBINING_MARKS.has(mark)
        ? [base]
        : [];
  } else {
    parts = chars.map((char) => {
      const at = SMALL.indexOf(char);
      return at === -1 ? char : (FULL[at] ?? char);
    });
  }
  const self = keyOf(track, kana);
  return [...new Set(parts.map((part) => keyOf(track, part)))].filter(
    (key) => key !== self && own.has(key),
  );
}

/** A katakana written in hiragana: the code points are 0x60 apart. */
function toHiragana(kana: string): string {
  return Array.from(kana)
    .map((char) => {
      const code = char.codePointAt(0) ?? 0;
      return code >= 0x30a1 && code <= 0x30f6 ? String.fromCodePoint(code - 0x60) : char;
    })
    .join('');
}

const TRACKS: readonly Track[] = ['hiragana', 'katakana'];

function build(): {
  items: ReadonlyMap<LearnKanaKey, KanaItem>;
  byTrack: Readonly<Record<Track, readonly KanaItem[]>>;
  rows: Readonly<
    Record<Track, readonly { readonly id: RowId; readonly keys: readonly LearnKanaKey[] }[]>
  >;
} {
  const own = new Set<LearnKanaKey>(
    TRACKS.flatMap((track) =>
      kanaRows(track).flatMap((row) => row.kana.map((kana) => keyOf(track, kana))),
    ),
  );
  // A katakana and its hiragana are each other's `pair`.
  const pairs = new Map<LearnKanaKey, LearnKanaKey>();
  for (const row of kanaRows('katakana')) {
    for (const kana of row.kana) {
      const hira = keyOf('hiragana', toHiragana(kana));
      if (own.has(hira)) {
        pairs.set(keyOf('katakana', kana), hira);
        pairs.set(hira, keyOf('katakana', kana));
      }
    }
  }
  const items = new Map<LearnKanaKey, KanaItem>();
  const byTrack: Record<Track, KanaItem[]> = { hiragana: [], katakana: [] };
  const rows: Record<Track, { id: RowId; keys: LearnKanaKey[] }[]> = { hiragana: [], katakana: [] };
  for (const track of TRACKS) {
    for (const row of kanaRows(track)) {
      const id: RowId = `${track}:${row.id}`;
      const keys: LearnKanaKey[] = [];
      for (const kana of row.kana) {
        const key = keyOf(track, kana);
        const item: KanaItem = {
          key,
          kana,
          track,
          row: id,
          category: row.category,
          index: byTrack[track].length,
          parts: partsOf(track, kana, own),
          pair: pairs.get(key) ?? null,
        };
        items.set(key, item);
        byTrack[track].push(item);
        keys.push(key);
      }
      rows[track].push({ id, keys });
    }
  }
  return { items, byTrack, rows };
}

const BUILT = build();

/** Both tracks, hiragana first, each in track order: 104 + 125 = 229 entries. */
export const ITEMS: ReadonlyMap<LearnKanaKey, KanaItem> = BUILT.items;

export function trackItems(track: Track): readonly KanaItem[] {
  return BUILT.byTrack[track];
}

/** The rows of a track in table order, each with its keys in order. */
export function trackRows(
  track: Track,
): readonly { readonly id: RowId; readonly keys: readonly LearnKanaKey[] }[] {
  return BUILT.rows[track];
}

/** Whether an event's `k` names a word rather than a kana. */
export function isWordKey(key: LearnKanaKey | WordKey | RuleKey): key is WordKey {
  return key.startsWith('word:');
}

/** Whether an event's `k` names a rule of っ or ー: not an item (P9 plan, D3). */
export function isRuleKey(key: LearnKanaKey | WordKey | RuleKey): key is RuleKey {
  return key.startsWith('rule:');
}

/** The learnable kana of a reading, longest match first (two characters, then one); others are skipped. */
export function kanaOfReading(reading: string): readonly LearnKanaKey[] {
  const chars = Array.from(reading);
  const keys: LearnKanaKey[] = [];
  for (let at = 0; at < chars.length;) {
    const two = chars.slice(at, at + 2).join('');
    const pair = at + 1 < chars.length ? keyOfText(two) : undefined;
    if (pair !== undefined) {
      keys.push(pair);
      at += 2;
      continue;
    }
    const one = keyOfText(chars[at] ?? '');
    if (one !== undefined) keys.push(one);
    at += 1;
  }
  return keys;
}

/** The key of whichever track holds the text, hiragana first. */
function keyOfText(text: string): LearnKanaKey | undefined {
  for (const track of TRACKS) {
    const key = keyOf(track, text);
    if (ITEMS.has(key)) return key;
  }
  return undefined;
}
