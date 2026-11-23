import { kanaRows } from '@nekotype/engine';
import type { RowCategory } from '@nekotype/engine';
import type { ChartState, LearnView } from '@nekotype/model';
import type { LearnKanaKey, Track } from '@nekotype/shared/types';
import { keyOf } from './tracks';

export type CellState = ChartState;

/** What the kana chart shows of one kana; the strings are made above this layer. */
export type KanaCellInfo = {
  readonly key: LearnKanaKey;
  readonly kana: string;
  readonly state: CellState;
  /** Learned or mastered, and the review comes within the next gap (what `continue` takes). */
  readonly due: boolean;
  /** The predicted recall reaches 0.90; `null` unless the kana is learned or mastered. */
  readonly dueAt: number | null;
  /** Shown in an introduction at least once. */
  readonly introduced: boolean;
  /** The locked kana that opens next. */
  readonly opensNext: boolean;
  /** Recall answers among the last 10. */
  readonly answers: number;
  readonly medianMs: number;
  readonly accuracy: number;
  /** Kana given instead of this one in recognition and recall, most first. */
  readonly confusions: readonly { readonly key: LearnKanaKey; readonly count: number }[];
  readonly recognitions: number;
  readonly recognitionErrors: number;
};

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

/** The cell of every kana of a track, by key. `now` decides which kana are due. */
export function cellInfos(
  track: Track,
  view: LearnView,
  now: number,
): ReadonlyMap<LearnKanaKey, KanaCellInfo> {
  const cells = new Map<LearnKanaKey, KanaCellInfo>();
  for (const row of chartRows(track)) {
    for (const kana of row.kana) {
      if (kana === null) continue;
      const key = keyOf(track, kana);
      const kanaView = view.kana.get(key);
      if (kanaView === undefined) continue;
      cells.set(key, {
        key,
        kana,
        state: kanaView.state,
        due: kanaView.dueFrom !== null && kanaView.dueFrom <= now,
        dueAt: kanaView.nextReviewAt,
        introduced: kanaView.state !== 'locked',
        opensNext: view.opensNext[track] === key,
        answers: kanaView.recall.length,
        medianMs: kanaView.medianMs,
        accuracy: kanaView.accuracy,
        confusions: kanaView.confusions,
        recognitions: kanaView.recognitions,
        recognitionErrors: kanaView.recognitionErrors,
      });
    }
  }
  return cells;
}
