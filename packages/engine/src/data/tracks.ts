import type { KanaRow, RowCategory, RowId, Script } from '../types';
import { basicRows } from './basic';
import { dakutenRows } from './dakuten';
import { yoonRows } from './yoon';
import { extendedRows } from './extended';

const selectableRows: readonly KanaRow[] = [
  ...basicRows,
  ...dakutenRows,
  ...yoonRows,
  ...extendedRows,
];

// A row of a learning track: the row's kana in one script, in table order.
export type TrackRow = {
  readonly id: RowId;
  readonly name: string;
  readonly category: RowCategory;
  readonly kana: readonly string[];
};

function kanaOfRow(row: KanaRow, script: Script): readonly string[] {
  const kana: string[] = [];
  for (const entry of row.entries) {
    const text = script === 'hiragana' ? entry.hiragana : entry.katakana;
    if (text !== undefined) kana.push(text);
  }
  return kana;
}

const rowsByScript: Readonly<Record<Script, readonly TrackRow[]>> = {
  hiragana: composeRows('hiragana'),
  katakana: composeRows('katakana'),
};

const kanaByScript: Readonly<Record<Script, readonly string[]>> = {
  hiragana: rowsByScript.hiragana.flatMap((row) => row.kana),
  katakana: rowsByScript.katakana.flatMap((row) => row.kana),
};

function composeRows(script: Script): readonly TrackRow[] {
  const rows: TrackRow[] = [];
  for (const row of selectableRows) {
    const kana = kanaOfRow(row, script);
    if (kana.length > 0) rows.push({ id: row.id, name: row.name, category: row.category, kana });
  }
  return rows;
}

/** The kana of a learning track in table order, which is also the unlock order (learning.md). */
export function kanaOf(script: Script): readonly string[] {
  return kanaByScript[script];
}

/** The rows of a track for the kana chart; rows with no kana in the script are left out. */
export function kanaRows(script: Script): readonly TrackRow[] {
  return rowsByScript[script];
}
