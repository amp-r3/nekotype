import type { RowCategory } from '@nekotype/engine';
import type { LearnView, RowId } from '@nekotype/model';
import type { LearnKanaKey, Track } from '@nekotype/shared/types';
import { chartRows } from './rows';
import { keyOf } from './tracks';

// The path of a track: its blocks and rows with how far the learner has come (P8 plan, D4). It
// reads the engine's rows, which the initial chunk holds already, and `LearnView`; no model call.

export type RowState = 'done' | 'current' | 'locked';

export type PathRow = {
  /** `${track}:${row.id}`, as `RowId` of `@nekotype/model`. */
  readonly id: RowId;
  /** As `chartRows` gives it: '' for the vowels, 'k', 'sh', 'fa'. */
  readonly head: string;
  readonly keys: readonly LearnKanaKey[];
  readonly state: RowState;
  /** Kana not locked. */
  readonly introduced: number;
  /** Kana learned or mastered. */
  readonly learned: number;
  readonly total: number;
};

export type PathBlock = {
  readonly category: RowCategory;
  readonly state: RowState;
  readonly rows: readonly PathRow[];
  readonly introduced: number;
  readonly learned: number;
  readonly total: number;
};

export type TrackPath = {
  readonly track: Track;
  readonly blocks: readonly PathBlock[];
  /** The row being opened: the first row not done; null when every row is done. */
  readonly current: RowId | null;
};

const sum = (values: readonly number[]): number => values.reduce((a, b) => a + b, 0);

/**
 * `done`: every kana of the row is introduced. `current`: the first row, in table order, that is
 * not done. `locked`: any other row that is not done, even one with an introduced kana (a
 * dakuten kana whose base was learned out of order).
 */
export function pathOf(view: LearnView, track: Track): TrackPath {
  let current: RowId | null = null;
  const rows: { readonly category: RowCategory; readonly row: PathRow }[] = [];
  for (const info of chartRows(track)) {
    const keys = info.kana.filter((kana) => kana !== null).map((kana) => keyOf(track, kana));
    const states = keys.map((key) => view.kana.get(key)?.state ?? 'locked');
    const introduced = states.filter((state) => state !== 'locked').length;
    const id: RowId = `${track}:${info.id}`;
    const done = introduced === keys.length;
    if (!done && current === null) current = id;
    rows.push({
      category: info.category,
      row: {
        id,
        head: info.head,
        keys,
        state: done ? 'done' : current === id ? 'current' : 'locked',
        introduced,
        learned: states.filter((state) => state === 'learned' || state === 'mastered').length,
        total: keys.length,
      },
    });
  }

  // Consecutive rows of one category form a block.
  const groups: { category: RowCategory; rows: PathRow[] }[] = [];
  for (const { category, row } of rows) {
    const last = groups[groups.length - 1];
    if (last !== undefined && last.category === category) last.rows.push(row);
    else groups.push({ category, rows: [row] });
  }
  return {
    track,
    current,
    blocks: groups.map((block) => ({
      category: block.category,
      rows: block.rows,
      state: block.rows.every((row) => row.state === 'done')
        ? 'done'
        : block.rows.some((row) => row.state === 'current')
          ? 'current'
          : 'locked',
      introduced: sum(block.rows.map((row) => row.introduced)),
      learned: sum(block.rows.map((row) => row.learned)),
      total: sum(block.rows.map((row) => row.total)),
    })),
  };
}
