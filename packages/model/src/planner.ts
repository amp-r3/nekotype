import type { LearnKanaKey, Rng, Track } from '@nekotype/shared/types';
import { DAY_MS, RECOGNITION_SHARE, STEP_MS, TRACK_LAG } from './constants';
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

type Candidate = {
  readonly key: LearnKanaKey;
  /** Due: the lowest predicted recall first, so the highest of this. Learning: the oldest `lastTask`, negated. */
  readonly score: number;
  readonly rank: number;
};

function better(a: Candidate, b: Candidate | null): boolean {
  return b === null || a.score > b.score || (a.score === b.score && a.rank < b.rank);
}

function parts(key: LearnKanaKey): readonly LearnKanaKey[] {
  return ITEMS.get(key)?.parts ?? [];
}

/** The first new kana of `track` whose parts are all learned, in track order. */
function firstEligible(state: ModelState, track: Track): LearnKanaKey | null {
  for (const item of trackItems(track)) {
    if (state.items.has(item.key)) continue;
    if (parts(item.key).every((part) => state.items.get(part)?.phase === 'learned')) {
      return item.key;
    }
  }
  return null;
}

function introduced(state: ModelState, track: Track): number {
  let count = 0;
  for (const key of state.items.keys()) if (ITEMS.get(key)?.track === track) count += 1;
  return count;
}

function introduction(state: ModelState, track: Track): LearnKanaKey | null {
  const own = firstEligible(state, track);
  const other: Track = track === 'hiragana' ? 'katakana' : 'hiragana';
  const otherCount = introduced(state, other);
  if (otherCount > 0 && introduced(state, track) - otherCount > TRACK_LAG) {
    const lagging = firstEligible(state, other);
    if (lagging !== null) return lagging;
  }
  return own;
}

/** The next task of a session; null when there is nothing to offer, which ends the session. */
export function nextTask(state: ModelState, ctx: PlanContext): PlannedTask | null {
  const { now, previous } = ctx;
  const ahead = now + horizonMs(state);
  const factor = intervalFactor(requestedRetention(state));

  let due: Candidate | null = null;
  let ready: Candidate | null = null;
  let waiting: Candidate | null = null;
  let learning = 0;
  let previousState: { readonly item: ItemState; readonly due: boolean } | null = null;

  for (const [key, item] of state.items) {
    const isDue =
      item.phase === 'learned' && item.lastAt + item.memory.stability * factor * DAY_MS <= ahead;
    if (item.phase === 'learning') learning += 1;
    if (key === previous) {
      previousState = { item, due: isDue };
      continue;
    }
    const rank = rankOf(key);
    if (isDue) {
      const candidate = { key, score: (ahead - item.lastAt) / item.memory.stability, rank };
      if (better(candidate, due)) due = candidate;
    } else if (item.phase === 'learning') {
      const candidate = { key, score: -item.lastTask, rank };
      const isReady = now - item.lastAt >= STEP_MS * 2 ** item.streak;
      if (isReady) {
        if (better(candidate, ready)) ready = candidate;
      } else if (better(candidate, waiting)) {
        waiting = candidate;
      }
    }
  }

  if (due !== null) return { kind: 'recall', key: due.key, review: true };
  if (ready !== null) return learningTask(ready.key, ctx);
  if (learning < learningLimit(state)) {
    const key = introduction(state, ctx.track);
    if (key !== null) return { kind: 'introduction', key };
  }
  if (waiting !== null) return learningTask(waiting.key, ctx);

  // Nothing else is left: the previous kana again, when it is due or learning.
  if (previous !== null && previousState !== null) {
    if (previousState.due) return { kind: 'recall', key: previous, review: true };
    if (previousState.item.phase === 'learning') return learningTask(previous, ctx);
  }
  return null;
}

/** A learning kana is a recognition one time in four (one draw), otherwise a recall. */
function learningTask(key: LearnKanaKey, ctx: PlanContext): PlannedTask {
  return ctx.rng.next() < RECOGNITION_SHARE
    ? { kind: 'recognition', key }
    : { kind: 'recall', key, review: false };
}
