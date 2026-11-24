import { kanaRows } from '@nekotype/engine';
import type { RowCategory } from '@nekotype/engine';
import type { RowId } from '@nekotype/model';
import type { Track } from '@nekotype/shared/types';

// The rows of a track as the chart and the path name them. Small and in the initial chunk: the
// home's reason names a row. The cells (`chart.ts`) and the path (`path.ts`) are not.

export type ChartRowInfo = {
  readonly id: string;
  readonly category: RowCategory;
  /** The consonant of the row, empty for the vowels. */
  readonly head: string;
  /** The name of the row from the kana table (romaji). */
  readonly name: string;
  /** One slot per column; `null` is a gap. */
  readonly kana: readonly (string | null)[];
};

const COLUMNS_OF_Y: readonly number[] = [0, 2, 4];

function headOf(id: string, name: string, category: RowCategory): string {
  if (id === 'vowels') return '';
  if (id === 'w_n') return 'w';
  if (category === 'extended') return (name.split(' ')[0] ?? id).toLowerCase();
  return id;
}

/** The rows of a track for the chart; only the row of や ゆ よ has gaps, to line up the vowels. */
export function chartRows(track: Track): readonly ChartRowInfo[] {
  return kanaRows(track).map((row) => ({
    id: row.id,
    category: row.category,
    head: headOf(row.id, row.name, row.category),
    name: row.name,
    kana:
      row.id === 'y'
        ? Array.from({ length: 5 }, (_, column) => {
            const at = COLUMNS_OF_Y.indexOf(column);
            return at === -1 ? null : (row.kana[at] ?? null);
          })
        : row.kana,
  }));
}

const HEADS = new Map<string, string>(
  (['hiragana', 'katakana'] as const).flatMap((track) =>
    chartRows(track).map((row): [string, string] => [`${track}:${row.id}`, row.head]),
  ),
);

/** The head of a row as the chart shows it (`k`, `sh`, `fa`); '' for the vowels and an unknown row. */
export function headOfRow(id: RowId): string {
  return HEADS.get(id) ?? '';
}
