import type { LearnState } from '@nekotype/shared/types';

type Runs = LearnState['activeDays'];

/** Adds a day to the runs of active days, joining a run it touches. */
export function addActiveDay(runs: Runs, day: number): Runs {
  const result: [number, number][] = [];
  let placed = false;
  let current: [number, number] = [day, day];
  for (const [first, last] of runs) {
    if (last + 1 < current[0]) {
      result.push([first, last]);
    } else if (current[1] + 1 < first) {
      if (!placed) result.push(current);
      placed = true;
      result.push([first, last]);
    } else {
      current = [Math.min(first, current[0]), Math.max(last, current[1])];
    }
  }
  if (!placed) result.push(current);
  const same = JSON.stringify(result) === JSON.stringify(runs);
  return same ? runs : result;
}

/** The consecutive active days ending today, or yesterday while today has no answer; else 0. */
export function currentStreak(runs: Runs, today: number): number {
  const last = runs[runs.length - 1];
  if (last === undefined || last[1] < today - 1) return 0;
  return last[1] - last[0] + 1;
}

export function bestStreak(runs: Runs): number {
  return runs.reduce((best, [first, last]) => Math.max(best, last - first + 1), 0);
}
