import type { LearnKanaKey, Rng, Track } from '@nekotype/shared/types';
import { WEAK_ACCURACY, WEAK_CONFUSIONS, WEAK_MIN_RECALLS } from './constants';
import type { ModelState } from './fold';
import { ITEMS } from './items';
import type { RowId } from './items';
import { nextTask } from './planner';
import type { KanaView, LearnView } from './view';

/** What Continue does first: a label read from the planner's first task, never a mode. */
export type Reason =
  /** The first task is a review: `due` kana of both tracks are due now. */
  | { readonly kind: 'review'; readonly due: number }
  /** The first task is a learning kana, and some learning kana are weak (track order). */
  | { readonly kind: 'weak'; readonly keys: readonly LearnKanaKey[] }
  /** The first task is a learning kana, and none is weak: `learning` kana of both tracks learn. */
  | { readonly kind: 'learning'; readonly learning: number }
  /** The first task introduces `key` of `row`; the row may be of the other track (`TRACK_LAG`). */
  | { readonly kind: 'new'; readonly key: LearnKanaKey; readonly row: RowId }
  /** The planner offers nothing: the smallest `dueFrom` of a learned or mastered kana. */
  | { readonly kind: 'none'; readonly nextAt: number };

/** The draw only chooses recall or recognition of a learning kana, which the reason does not name. */
const ALWAYS_RECALL: Rng = { next: () => 1 };

/** A learning kana the learner has trouble with. */
export function isWeak(kana: KanaView): boolean {
  if (kana.state !== 'learning') return false;
  if (kana.recall.length >= WEAK_MIN_RECALLS && kana.accuracy < WEAK_ACCURACY) return true;
  let confusions = 0;
  for (const confusion of kana.confusions) confusions += confusion.count;
  return confusions >= WEAK_CONFUSIONS;
}

/** What Continue does first; `view` is `describe` of `state`. Pure: no clock, no random draw. */
export function reasonOf(
  state: ModelState,
  view: LearnView,
  ctx: { readonly now: number; readonly track: Track },
): Reason {
  const { now } = ctx;
  const first = nextTask(state, { now, track: ctx.track, previous: null, rng: ALWAYS_RECALL });
  if (first === null) {
    // One exists whenever the planner offers nothing: a learned kana is due later.
    let nextAt = Number.POSITIVE_INFINITY;
    for (const kana of view.kana.values()) {
      if (kana.dueFrom !== null && kana.dueFrom < nextAt) nextAt = kana.dueFrom;
    }
    return { kind: 'none', nextAt };
  }
  if (first.kind === 'introduction') {
    return { kind: 'new', key: first.key, row: ITEMS.get(first.key)?.row ?? 'hiragana:' };
  }
  if (first.kind === 'recall' && first.review) {
    let due = 0;
    for (const kana of view.kana.values()) {
      if (kana.dueFrom !== null && kana.dueFrom <= now) due += 1;
    }
    return { kind: 'review', due };
  }
  const weak: LearnKanaKey[] = [];
  let learning = 0;
  for (const [key, kana] of view.kana) {
    if (kana.state === 'learning') learning += 1;
    if (isWeak(kana)) weak.push(key);
  }
  return weak.length > 0 ? { kind: 'weak', keys: weak } : { kind: 'learning', learning };
}
