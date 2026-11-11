import type {
  KanaEntry,
  KanaRow,
  RowCategory,
  RowId,
  StandaloneRow,
  StandaloneRowId,
} from '../types';

// The kana tables are part of the first load, so they are written compactly and expanded into the
// `KanaRow` shape once, when the module loads. An entry is the kana, a space and the IME spellings
// (canonical first), separated by commas; the learner spellings follow a `/`. Entries are separated
// by `|`:
//   'しシ shi,si'          し and シ, IME spellings shi and si, no learner spelling
//   'ちゃチャ cha,tya/cya'  learner spelling cya
//   'ファ fa/fua,huxa'      katakana only
const KATAKANA = /[\u30a0-\u30ff]/;

function entryOf(text: string): KanaEntry {
  const [kana = '', spellings = ''] = text.split(' ');
  const [ime = '', learner = ''] = spellings.split('/');
  // Every entry has katakana; the hiragana, when there is one, comes before it.
  const split = Math.max(kana.search(KATAKANA), 0);
  const spelled = {
    katakana: kana.slice(split),
    ime: ime.split(','),
    learner: learner === '' ? [] : learner.split(','),
  };
  return split > 0 ? { hiragana: kana.slice(0, split), ...spelled } : spelled;
}

const entriesOf = (text: string): readonly KanaEntry[] => text.split('|').map(entryOf);

// A row is named after the canonical spellings of its kana (`Ka - Ki - Ku - Ke - Ko`), unless
// it gives a name of its own.
const nameOf = (entries: readonly KanaEntry[]): string =>
  entries
    .map(({ ime: [first = ''] }) => `${first.charAt(0).toUpperCase()}${first.slice(1)}`)
    .join(' - ');

/** The rows of a category: `[id, entries]`, or `[id, entries, name]` for a name of its own. */
export function rowsOf(
  category: RowCategory,
  rows: readonly (readonly [RowId, string, string?])[],
): readonly KanaRow[] {
  return rows.map(([id, text, name]) => {
    const entries = entriesOf(text);
    return { id, name: name ?? nameOf(entries), category, entries };
  });
}

export function standaloneOf(id: StandaloneRowId, text: string): StandaloneRow {
  return { id, entries: entriesOf(text) };
}
