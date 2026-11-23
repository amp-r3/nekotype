import type { LearnView } from '@nekotype/model';

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

/** The longest run of consecutive days with an answer; 0 without any. */
export function bestStreakOfDays(days: ReadonlyMap<number, unknown>): number {
  const sorted = [...days.keys()].sort((a, b) => a - b);
  let best = 0;
  let run = 0;
  let previous = Number.NEGATIVE_INFINITY;
  for (const day of sorted) {
    run = day === previous + 1 ? run + 1 : 1;
    best = Math.max(best, run);
    previous = day;
  }
  return best;
}

/** The current and the best streak of the days that hold answers (the keys of `LogStats.days`). */
export function streaks(
  days: ReadonlyMap<number, unknown>,
  today: number,
): { current: number; best: number } {
  return { current: streakOfDays(days, today), best: bestStreakOfDays(days) };
}
