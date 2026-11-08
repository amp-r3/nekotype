import type { LearnBox, LearnEntry, RecallAnswer } from '@nekotype/shared/types';
import { dayStart, localDay } from './day';
import { isConfident } from './confidence';

/** Review interval of each box, days (learning.md, "Boxes"). Box 0 has none. */
export const BOX_DAYS: Readonly<Record<LearnBox, number>> = {
  0: 0,
  1: 1,
  2: 3,
  3: 7,
  4: 14,
  5: 30,
};

/** Boxes 4 and 5 count as mastered when the kana is also confident. */
export const MASTERED_BOX = 4;

/** The start of the local day that lies the box's interval after the day of `now`. */
export function dueAtFor(box: LearnBox, now: number): number {
  return box === 0 ? 0 : dayStart(localDay(now) + BOX_DAYS[box]);
}

/** In box 1 or higher and `dueAt` has passed. */
export function isDue(entry: LearnEntry | undefined, now: number): boolean {
  return entry !== undefined && entry.box >= 1 && entry.dueAt <= now;
}

const NEXT_BOX: Readonly<Record<LearnBox, LearnBox>> = { 0: 0, 1: 2, 2: 3, 3: 4, 4: 5, 5: 5 };

export function nextBox(box: LearnBox): LearnBox {
  return NEXT_BOX[box];
}

/** A kana in box 0 that is confident enters box 1. Returns the same entry otherwise. */
export function settleEntry(
  entry: LearnEntry,
  answers: readonly RecallAnswer[],
  targetMs: number,
  now: number,
): LearnEntry {
  if (entry.box !== 0 || !isConfident(answers, targetMs)) return entry;
  return { box: 1, dueAt: dueAtFor(1, now), updatedAt: now };
}

/**
 * The entry after a review (a task of a review session). A correct review moves up one box, an
 * error sends the kana back to box 1. Box 0 is not reviewed and stays.
 */
export function reviewEntry(entry: LearnEntry, ok: boolean, now: number): LearnEntry {
  if (entry.box === 0) return entry;
  const box: LearnBox = ok ? nextBox(entry.box) : 1;
  return { box, dueAt: dueAtFor(box, now), updatedAt: now };
}

export function isMastered(
  entry: LearnEntry | undefined,
  answers: readonly RecallAnswer[],
  targetMs: number,
): boolean {
  return entry !== undefined && entry.box >= MASTERED_BOX && isConfident(answers, targetMs);
}
