import type { LearnKanaKey, LearnState, Track } from '@nekotype/shared/types';
import { isDueKana, keysOfTrack } from '@/entities/learn';
import { REVIEW_TASKS } from './constants';

/**
 * The due kana of a track — the kana with the due mark on the chart (ADR 062) — oldest `dueAt`
 * first, ties in track order.
 */
export function dueKeys(
  state: LearnState,
  track: Track,
  targetMs: number,
  now: number,
): LearnKanaKey[] {
  const order = new Map(keysOfTrack(track).map((key, index) => [key, index]));
  return keysOfTrack(track)
    .filter((key) => isDueKana(state.entries[key], state.recent[key] ?? [], targetMs, now))
    .sort(
      (a, b) =>
        (state.entries[a]?.dueAt ?? 0) - (state.entries[b]?.dueAt ?? 0) ||
        (order.get(a) ?? 0) - (order.get(b) ?? 0),
    );
}

/** N of "Review (N)": the number of due kana of the track. */
export function dueCount(state: LearnState, track: Track, targetMs: number, now: number): number {
  return dueKeys(state, track, targetMs, now).length;
}

/** One recall task per due kana, oldest first, at most `REVIEW_TASKS`. */
export function reviewQueue(
  state: LearnState,
  track: Track,
  targetMs: number,
  now: number,
): LearnKanaKey[] {
  return dueKeys(state, track, targetMs, now).slice(0, REVIEW_TASKS);
}
