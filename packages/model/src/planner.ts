import type { LearnKanaKey, Rng, Track } from '@nekotype/shared/types';
import { DAY_MS, RECOGNITION_SHARE, REVIEW_WAIT_MS, STEP_MS, TRACK_LAG } from './constants';
import { itemSlots } from './fold';
import type { ItemState, ModelState } from './fold';
import { intervalFactor } from './fsrs';
import { ITEMS, trackItems } from './items';
import { horizonMs, learningLimit, requestedRetention } from './learner';

export type PlannedTask =
  | { readonly kind: 'introduction'; readonly key: LearnKanaKey }
  | { readonly kind: 'recall'; readonly key: LearnKanaKey; readonly review: boolean }
  | { readonly kind: 'recognition'; readonly key: LearnKanaKey };

export type PlanContext = {
  readonly now: number;
  /** `settings.learn.track`: where new kana come from. */
  readonly track: Track;
  /** The kana of the previous task of this session. */
  readonly previous: LearnKanaKey | null;
  readonly rng: Rng;
};

/** Position in track order, hiragana first: the tie-break of every list. */
function rankOf(key: LearnKanaKey): number {
  const item = ITEMS.get(key);
  return item === undefined
    ? Number.MAX_SAFE_INTEGER
    : (item.track === 'hiragana' ? 0 : 1000) + item.index;
}

/**
 * Whether `key` with `score` goes before `best` with `bestScore`: the higher score, then the lower
 * rank. Due: the lowest predicted recall first, so the highest score. Learning: the oldest
 * `lastTask`, negated. The rank is looked up only on a tie: the forecast plays up to 18,000 tasks.
 */
function better(
  key: LearnKanaKey,
  score: number,
  best: LearnKanaKey | null,
  bestScore: number,
): boolean {
  return best === null || score > bestScore || (score === bestScore && rankOf(key) < rankOf(best));
}

function partsLearned(state: ModelState, parts: readonly LearnKanaKey[]): boolean {
  for (const part of parts) if (state.items.get(part)?.phase !== 'learned') return false;
  return true;
}

/**
 * The first new kana of `track` whose parts are all learned, in track order. `introduced`: the
 * kana of the track in the state; when it is all of them, no kana is new.
 */
function firstEligible(state: ModelState, track: Track, introduced: number): LearnKanaKey | null {
  const items = trackItems(track);
  if (introduced === items.length) return null;
  for (const item of items) {
    if (state.items.has(item.key)) continue;
    if (partsLearned(state, item.parts)) return item.key;
  }
  return null;
}

function introduction(state: ModelState, track: Track): LearnKanaKey | null {
  const other: Track = track === 'hiragana' ? 'katakana' : 'hiragana';
  // Introduced kana of each track, from the slots' tracks.
  let ownCount = 0;
  let otherCount = 0;
  for (const slot of itemSlots(state.items).slots) {
    if (slot.track === track) ownCount += 1;
    else if (slot.track === other) otherCount += 1;
  }
  if (otherCount > 0 && ownCount - otherCount > TRACK_LAG) {
    const lagging = firstEligible(state, other, otherCount);
    if (lagging !== null) return lagging;
  }
  return firstEligible(state, track, ownCount);
}

/** The next task of a session; null when there is nothing to offer, which ends the session. */
export function nextTask(state: ModelState, ctx: PlanContext): PlannedTask | null {
  const { now, previous } = ctx;
  const ahead = now + horizonMs(state);
  const factor = intervalFactor(requestedRetention(state));

  // The best of each list as a key and its score: no object per kana.
  let due: LearnKanaKey | null = null;
  let dueScore = 0;
  let ready: LearnKanaKey | null = null;
  let readyScore = 0;
  let waiting: LearnKanaKey | null = null;
  let waitingScore = 0;
  let learning = 0;
  let previousItem: ItemState | null = null;
  let previousDue = false;

  // The items as an array (a fold keeps it beside its map); a key has one slot, so the previous
  // kana's slot is found once and compared by reference.
  const { slots, slotOf } = itemSlots(state.items);
  const previousSlot = previous === null ? undefined : slotOf(previous);
  for (const slot of slots) {
    const { key, item } = slot;
    const isDue =
      item.phase === 'learned' &&
      now - item.lastAt >= REVIEW_WAIT_MS &&
      item.lastAt + item.memory.stability * factor * DAY_MS <= ahead;
    if (item.phase === 'learning') learning += 1;
    if (slot === previousSlot) {
      previousItem = item;
      previousDue = isDue;
      continue;
    }
    if (isDue) {
      const score = (ahead - item.lastAt) / item.memory.stability;
      if (better(key, score, due, dueScore)) {
        due = key;
        dueScore = score;
      }
    } else if (item.phase === 'learning') {
      const score = -item.lastTask;
      const isReady = now - item.lastAt >= STEP_MS * 2 ** item.streak;
      if (isReady) {
        if (better(key, score, ready, readyScore)) {
          ready = key;
          readyScore = score;
        }
      } else if (better(key, score, waiting, waitingScore)) {
        waiting = key;
        waitingScore = score;
      }
    }
  }

  if (due !== null) return { kind: 'recall', key: due, review: true };
  if (ready !== null) return learningTask(ready, ctx);
  if (learning < learningLimit(state)) {
    const key = introduction(state, ctx.track);
    if (key !== null) return { kind: 'introduction', key };
  }
  if (waiting !== null) return learningTask(waiting, ctx);

  // Nothing else is left: the previous kana again, when it is due or learning.
  if (previous !== null && previousItem !== null) {
    if (previousDue) return { kind: 'recall', key: previous, review: true };
    if (previousItem.phase === 'learning') return learningTask(previous, ctx);
  }
  return null;
}

/** A learning kana is a recognition one time in four (one draw), otherwise a recall. */
function learningTask(key: LearnKanaKey, ctx: PlanContext): PlannedTask {
  return ctx.rng.next() < RECOGNITION_SHARE
    ? { kind: 'recognition', key }
    : { kind: 'recall', key, review: false };
}
