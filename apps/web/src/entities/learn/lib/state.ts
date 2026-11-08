import type { Counters, LearnState, Track } from '@nekotype/shared/types';
import { initialUnlocked } from './tracks';
import { isLearnKanaKey } from '@nekotype/shared/runtime';
import { isConfident } from './confidence';
import { settleEntry } from './boxes';
import { keysOfTrack, nextUnlock } from './tracks';

export const TRACKS: readonly Track[] = ['hiragana', 'katakana'];

export function initialLearnState(): LearnState {
  return {
    unlocked: {
      hiragana: initialUnlocked('hiragana'),
      katakana: initialUnlocked('katakana'),
    },
    entries: {},
    recent: {},
    stats: {},
    activeDays: [],
    recallBuckets: { hiragana: {}, katakana: {} },
  };
}

export function initialCounters(): Counters {
  return {
    started: { typing: 0, learn: 0 },
    finished: { typing: 0, learn: 0 },
  };
}

/**
 * Unlocks the next kana of each track when every unlocked kana is confident (learning.md,
 * "Unlocking"). The unlocked set never shrinks. Returns the same object when nothing unlocks.
 */
export function evaluateUnlocking(state: LearnState, targetMs: number): LearnState {
  let result = state;
  for (const track of TRACKS) {
    const unlocked = result.unlocked[track];
    const next = nextUnlock(track, unlocked, (key) =>
      isConfident(result.recent[key] ?? [], targetMs),
    );
    if (next === null) continue;
    const open = new Set([...unlocked, next]);
    // The list stays in track order: ヴ unlocks before the ヴァ and ヴィ that come first in the table.
    result = {
      ...result,
      unlocked: { ...result.unlocked, [track]: keysOfTrack(track).filter((key) => open.has(key)) },
    };
  }
  return result;
}

/**
 * Box 1 at first confidence (learning.md, "Boxes"): checked whenever unlocking is. Returns the same
 * object when no entry moves.
 */
export function evaluateBoxes(state: LearnState, targetMs: number, now: number): LearnState {
  let entries = state.entries;
  for (const [key, entry] of Object.entries(state.entries)) {
    if (!isLearnKanaKey(key)) continue;
    const settled = settleEntry(entry, state.recent[key] ?? [], targetMs, now);
    if (settled !== entry) entries = { ...entries, [key]: settled };
  }
  return entries === state.entries ? state : { ...state, entries };
}
