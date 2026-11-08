import type { LearnState, Track } from '@nekotype/shared/types';
import { isMastered } from './boxes';
import { keysOfTrack } from './tracks';
import { dailyMedians } from './buckets';
import { bestStreak, currentStreak } from './streak';

export type TrackProgress = {
  readonly mastered: number;
  readonly total: number;
  /** Daily median recall answer time, ascending by day. */
  readonly medians: readonly { day: number; ms: number }[];
};

/** Mastered kana of a track against the target answer time. */
export function masteredCount(state: LearnState, track: Track, targetMs: number): number {
  return keysOfTrack(track).filter((key) =>
    isMastered(state.entries[key], state.recent[key] ?? [], targetMs),
  ).length;
}

export function trackProgress(state: LearnState, track: Track, targetMs: number): TrackProgress {
  return {
    mastered: masteredCount(state, track, targetMs),
    total: keysOfTrack(track).length,
    medians: dailyMedians(state.recallBuckets, track),
  };
}

export function streaks(state: LearnState, today: number): { current: number; best: number } {
  return { current: currentStreak(state.activeDays, today), best: bestStreak(state.activeDays) };
}
