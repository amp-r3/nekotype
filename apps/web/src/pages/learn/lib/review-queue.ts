import type { LearnKanaKey, LearnState, Track } from '@nekotype/shared/types';
import { isDue, keysOfTrack } from '@/entities/learn';
import { REVIEW_TASKS } from './constants';

/** The due kana of a track, oldest `dueAt` first, ties in track order. */
export function dueKeys(state: LearnState, track: Track, now: number): LearnKanaKey[] {
  const order = new Map(keysOfTrack(track).map((key, index) => [key, index]));
  return keysOfTrack(track)
    .filter((key) => isDue(state.entries[key], now))
    .sort(
      (a, b) =>
        (state.entries[a]?.dueAt ?? 0) - (state.entries[b]?.dueAt ?? 0) ||
        (order.get(a) ?? 0) - (order.get(b) ?? 0),
    );
}

/** N of "Review (N)": the number of due kana of the track. */
export function dueCount(state: LearnState, track: Track, now: number): number {
  return dueKeys(state, track, now).length;
}

/** One recall task per due kana, oldest first, at most `REVIEW_TASKS`. */
export function reviewQueue(state: LearnState, track: Track, now: number): LearnKanaKey[] {
  return dueKeys(state, track, now).slice(0, REVIEW_TASKS);
}
