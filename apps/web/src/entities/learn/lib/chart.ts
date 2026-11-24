import type { ChartState, LearnView } from '@nekotype/model';
import type { LearnKanaKey, Track } from '@nekotype/shared/types';
import { chartRows } from './rows';
import { keyOf } from './tracks';

export { chartRows };
export type { ChartRowInfo } from './rows';

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
