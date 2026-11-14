import type { TestResult } from '@nekotype/shared/types';
import { personalBestKey } from '@nekotype/shared/runtime';
import { localDay } from '@/entities/learn';

export type Period = '7' | '30' | 'all';
/** `mode` is a `personalBestKey()` or `'all'`. */
export type Filters = { mode: string; period: Period; repeats: boolean };

export type ModeOption = { key: string; label: string; count: number };

export type Figures = {
  tests: number;
  /** A whole percent. */
  accuracy: number;
  medianKpm: number | null;
  bestKpm: number | null;
};

/** The mean of the two middle values for an even count; 0 for none. */
export function median(values: readonly number[]): number {
  const sorted = [...values].sort((a, b) => a - b);
  const mid = Math.floor(sorted.length / 2);
  const hi = sorted[mid];
  const lo = sorted[mid - 1];
  if (hi === undefined) return 0;
  return sorted.length % 2 === 1 || lo === undefined ? hi : (lo + hi) / 2;
}

/** The distinct modes of the results, most results first, ties by label (S3). */
export function modesOf(
  results: readonly TestResult[],
  label: (key: string) => string,
): ModeOption[] {
  const counts = new Map<string, number>();
  for (const result of results) {
    const key = personalBestKey(result);
    counts.set(key, (counts.get(key) ?? 0) + 1);
  }
  return [...counts]
    .map(([key, count]) => ({ key, label: label(key), count }))
    .sort((a, b) => b.count - a.count || a.label.localeCompare(b.label));
}

/** The key of the newest result (the last one, the results are oldest first); `'all'` for none. */
export function defaultMode(results: readonly TestResult[]): string {
  const newest = results.reduce<TestResult | null>(
    (best, result) => (best === null || result.endedAt >= best.endedAt ? result : best),
    null,
  );
  return newest === null ? 'all' : personalBestKey(newest);
}

const PERIOD_DAYS: Record<Period, number | null> = { '7': 7, '30': 30, all: null };

/** The results the filters let through, oldest first. Periods are whole local days (S4). */
export function select(
  results: readonly TestResult[],
  filters: Filters,
  today: number,
): TestResult[] {
  const days = PERIOD_DAYS[filters.period];
  return results
    .filter(
      (result) =>
        (filters.mode === 'all' || personalBestKey(result) === filters.mode) &&
        (filters.repeats || !result.repeated) &&
        (days === null || localDay(result.endedAt) > today - days),
    )
    .sort((a, b) => a.endedAt - b.endedAt);
}

/** The figures of a selection; the KPM ones only for one mode, over tests that are not repeats. */
export function figures(selection: readonly TestResult[], oneMode: boolean): Figures {
  const kpm = selection.filter((result) => !result.repeated).map((result) => result.kpm);
  return {
    tests: selection.length,
    accuracy: Math.round(median(selection.map((result) => result.kanaAccuracy)) * 100),
    medianKpm: oneMode && kpm.length > 0 ? Math.round(median(kpm)) : null,
    bestKpm: oneMode && kpm.length > 0 ? Math.round(Math.max(...kpm)) : null,
  };
}

/** The selection is not empty and all its results share one mode (`personalBestKey`). */
export function oneMode(selection: readonly TestResult[]): boolean {
  const first = selection[0];
  if (first === undefined) return false;
  const key = personalBestKey(first);
  return selection.every((result) => personalBestKey(result) === key);
}
