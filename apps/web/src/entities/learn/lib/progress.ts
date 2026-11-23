import type { LearnView } from '@nekotype/model';
import type { LearnState, Track } from '@nekotype/shared/types';
import { isMastered } from './boxes';
import { keysOfTrack } from './tracks';
import { bestStreak, currentStreak } from './streak';

export type TrackProgress = {
  readonly mastered: number;
  readonly total: number;
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
  };
}

export function streaks(state: LearnState, today: number): { current: number; best: number } {
  return { current: currentStreak(state.activeDays, today), best: bestStreak(state.activeDays) };
}

/** Kana of both tracks whose review `continue` takes: what the `due` part of the progress line counts. */
export function dueCount(view: LearnView, now: number): number {
  let n = 0;
  for (const kana of view.kana.values()) {
    if (kana.dueFrom !== null && kana.dueFrom <= now) n += 1;
  }
  return n;
}

/** The consecutive days with an answer ending today, or yesterday while today has none; else 0. */
export function streakOfDays(days: ReadonlyMap<number, unknown>, today: number): number {
  let day = days.has(today) ? today : today - 1;
  let streak = 0;
  while (days.has(day)) {
    streak += 1;
    day -= 1;
  }
  return streak;
}
