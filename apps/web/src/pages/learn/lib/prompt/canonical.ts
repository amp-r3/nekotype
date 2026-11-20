import { engineTable } from '@nekotype/engine';
import type { KanaKey } from '@nekotype/engine';

// The canonical spelling needs only the table, not the matcher. The learning screen reads it on
// the first paint, so it lives apart from `engine.ts`: that module drags the whole engine into the
// initial chunk (ADR 027 budgets).
const canonicalByKey = new Map<KanaKey, string>();
for (const row of engineTable) {
  for (const entry of row.entries) {
    const canonical = entry.ime[0] ?? '';
    if (entry.hiragana !== undefined) canonicalByKey.set(`hiragana:${entry.hiragana}`, canonical);
    canonicalByKey.set(`katakana:${entry.katakana}`, canonical);
  }
}

/** The first IME spelling of a kana; empty for an unknown key. */
export function canonicalFor(key: KanaKey): string {
  return canonicalByKey.get(key) ?? '';
}
