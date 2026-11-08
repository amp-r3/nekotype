import { kanaRows } from '@nekotype/engine';
import type { RowCategory } from '@nekotype/engine';
import type { LearnKanaKey, LearnState, Track } from '@nekotype/shared/types';
import { isLearnKanaKey } from '@nekotype/shared/runtime';
import { isConfident, accuracyOf, medianAnswerMs } from './confidence';
import { isDue, isMastered } from './boxes';
import { keyOf, nextUnlock } from './tracks';

export type CellState = 'locked' | 'learning' | 'confident' | 'mastered';

/** What the kana chart shows of one kana; the strings are made above this layer. */
export type KanaCellInfo = {
  readonly key: LearnKanaKey;
  readonly kana: string;
  readonly state: CellState;
  /** The review date has come; only for confident and mastered kana. */
  readonly due: boolean;
  /** The next review, from box 1; `null` for a kana that is not scheduled. */
  readonly dueAt: number | null;
  /** Unlocked and shown in an introduction at least once. */
  readonly introduced: boolean;
  /** The locked kana that opens next. */
  readonly opensNext: boolean;
  /** Recall answers among the last 10. */
  readonly answers: number;
  readonly medianMs: number;
  readonly accuracy: number;
  /** Kana chosen instead of this one in recognition, most first. */
  readonly mixups: readonly { readonly key: LearnKanaKey; readonly count: number }[];
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

/** The cell of every kana of a track, by key. `targetMs` is the target answer time. */
export function cellInfos(
  track: Track,
  state: LearnState,
  targetMs: number,
  now: number,
): ReadonlyMap<LearnKanaKey, KanaCellInfo> {
  const open = new Set(state.unlocked[track]);
  // The kana that opens once every unlocked kana is confident: the unlocked ones count as
  // confident here, so the dependencies decide which locked kana is first.
  const opening = nextUnlock(track, state.unlocked[track], (key) => open.has(key));
  const cells = new Map<LearnKanaKey, KanaCellInfo>();
  for (const row of chartRows(track)) {
    for (const kana of row.kana) {
      if (kana === null) continue;
      const key = keyOf(track, kana);
      const entry = state.entries[key];
      const answers = state.recent[key] ?? [];
      const stat = state.stats[key];
      const unlocked = open.has(key);
      const confident = unlocked && isConfident(answers, targetMs);
      const cellState: CellState = !unlocked
        ? 'locked'
        : isMastered(entry, answers, targetMs)
          ? 'mastered'
          : confident
            ? 'confident'
            : 'learning';
      cells.set(key, {
        key,
        kana,
        state: cellState,
        due: (cellState === 'confident' || cellState === 'mastered') && isDue(entry, now),
        dueAt: unlocked && entry !== undefined && entry.box >= 1 ? entry.dueAt : null,
        introduced: entry !== undefined,
        opensNext: key === opening,
        answers: answers.length,
        medianMs: medianAnswerMs(answers),
        accuracy: accuracyOf(answers),
        mixups: Object.entries(stat?.mixups ?? {})
          .flatMap(([mixed, count]) =>
            isLearnKanaKey(mixed) && count > 0 ? [{ key: mixed, count }] : [],
          )
          .sort((a, b) => b.count - a.count),
        recognitions: stat?.recognitions ?? 0,
        recognitionErrors: stat?.recognitionErrors ?? 0,
      });
    }
  }
  return cells;
}
