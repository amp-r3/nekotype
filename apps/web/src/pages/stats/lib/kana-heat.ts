import type { RowCategory } from '@nekotype/engine';
import type { KanaStat, LearnKanaKey, TestResult, Track } from '@nekotype/shared/types';
import { canonicalFor } from '@/entities/prompt';
import { chartRows, keyOf } from '@/entities/learn';
import type { KanaStatMap } from '@/entities/stats';

export type HeatStep = 0 | 1 | 2 | 3 | 4 | 5;

/** Percent of errored attempts above which a cell takes the next step (S8). */
const THRESHOLDS: readonly number[] = [0, 3, 7, 12, 20];

/**
 * The step of a kana: 0 for none errored, 1…5 over 0, 3, 7, 12 and 20 % of attempts with an error;
 * `null` for a kana never typed (no entry, or no attempts).
 */
export function heatStep(stat: KanaStat | undefined): HeatStep | null {
  if (stat === undefined || stat.attempts <= 0) return null;
  const scaled = stat.erroredAttempts * 100;
  let step = 0;
  for (const threshold of THRESHOLDS) {
    if (scaled > stat.attempts * threshold) step += 1;
  }
  return step === 0 ? 0 : step === 1 ? 1 : step === 2 ? 2 : step === 3 ? 3 : step === 4 ? 4 : 5;
}

export type HeatCell = {
  readonly id: string;
  readonly kana: string;
  readonly romaji: string;
  /** `null`: never typed. */
  readonly step: HeatStep | null;
  /** Share of attempts with an error, 0…1; 0 when never typed. */
  readonly rate: number;
  readonly attempts: number;
};

export type HeatRow = {
  readonly id: string;
  readonly head: string;
  readonly name: string;
  readonly block: RowCategory;
  /** One slot per column; `null` is a gap. */
  readonly cells: readonly (HeatCell | null)[];
};

// ん and ン end a word on one `n`, as in learning (ADR 062).
function romajiOf(key: LearnKanaKey, kana: string): string {
  return kana === 'ん' || kana === 'ン' ? 'n' : canonicalFor(key);
}

/** The rows of the kana table of a track, one cell per kana with its step, rate and attempts. */
export function heatRows(track: Track, stats: KanaStatMap): readonly HeatRow[] {
  return chartRows(track).map((row) => ({
    id: row.id,
    head: row.head,
    name: row.name,
    block: row.category,
    cells: row.kana.map((kana): HeatCell | null => {
      if (kana === null) return null;
      const key = keyOf(track, kana);
      const stat = stats[key];
      const step = heatStep(stat);
      return {
        id: key,
        kana,
        romaji: romajiOf(key, kana),
        step,
        rate: stat === undefined || step === null ? 0 : stat.erroredAttempts / stat.attempts,
        attempts: stat?.attempts ?? 0,
      };
    }),
  }));
}

/** The scripts that have a saved typing test; `both` counts for each. */
export function typedTracks(results: readonly Pick<TestResult, 'script'>[]): {
  hiragana: boolean;
  katakana: boolean;
} {
  let hiragana = false;
  let katakana = false;
  for (const result of results) {
    if (result.script !== 'katakana') hiragana = true;
    if (result.script !== 'hiragana') katakana = true;
  }
  return { hiragana, katakana };
}
