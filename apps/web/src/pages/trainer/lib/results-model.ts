import type { TestResult } from '@nekotype/shared/types';
import { isKanaKey, spellingsFor } from '@/entities/prompt';
import type { Strictness } from '@/entities/prompt';

const MAX_WEAK_KANA = 5;

export type Comparison = {
  // The signed whole number, with U+2212 for a minus; `0` has no sign.
  readonly delta: string;
  readonly reference: number;
};

export type KpmComparisons = {
  readonly kpm: number;
  readonly average: Comparison | null;
  // Against the best before this test: on a personal best "previous best", else "personal best".
  readonly best: Comparison | null;
};

export function signed(delta: number): string {
  if (delta > 0) return `+${String(delta)}`;
  if (delta < 0) return `−${String(-delta)}`;
  return '0';
}

function compare(kpm: number, reference: number | null): Comparison | null {
  if (reference === null) return null;
  const rounded = Math.round(reference);
  return { delta: signed(kpm - rounded), reference: rounded };
}

/**
 * The lines under KPM (design Stat): the difference to the average of the last tests of the mode
 * and to the best before this one. Whole numbers are compared, so the screen adds up as shown.
 */
export function kpmComparisons(
  result: TestResult,
  average: number | null,
  previousBest: number | null,
): KpmComparisons {
  const kpm = Math.round(result.kpm);
  return {
    kpm,
    average: compare(kpm, average),
    best: compare(kpm, previousBest),
  };
}

export type WeakKana = {
  readonly key: string;
  readonly glyph: string;
  // Accepted spellings in the test's strictness, canonical first.
  readonly spellings: readonly string[];
  readonly errors: number;
};

/**
 * Up to five kana with errors in this test, the most errors first (ties keep the order the session
 * reported them in). An error is a rejected key or a hint charged to the kana.
 */
export function weakKana(
  kanaErrors: Readonly<Record<string, number>>,
  strictness: Strictness,
): readonly WeakKana[] {
  const items: WeakKana[] = [];
  for (const [key, errors] of Object.entries(kanaErrors)) {
    if (errors <= 0 || !isKanaKey(key)) continue;
    items.push({
      key,
      glyph: key.slice(key.indexOf(':') + 1),
      spellings: spellingsFor(key, strictness),
      errors,
    });
  }
  items.sort((a, b) => b.errors - a.errors);
  return items.slice(0, MAX_WEAK_KANA);
}

/** Kana accuracy as shown: whole percent. */
export function accuracyPercent(result: TestResult): number {
  return Math.round(result.kanaAccuracy * 100);
}

/** Seconds as shown on the time stat: `60 s`, `12.5 s`. */
export function durationSeconds(result: TestResult): string {
  const seconds = Math.round(result.durationMs / 100) / 10;
  return String(seconds);
}
