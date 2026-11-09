import { allKanaRows } from '@nekotype/engine';

// The romaji the page asks for or accepts, worked out from what the page shows (ADR 045): the kana
// on screen, through the kana table.
export const romajiOf = new Map<string, string>();
for (const row of allKanaRows) {
  for (const entry of row.entries) {
    const romaji = entry.ime[0];
    if (romaji === undefined) continue;
    if (entry.hiragana !== undefined) romajiOf.set(entry.hiragana, romaji);
    romajiOf.set(entry.katakana, romaji);
  }
}

const DAY_MS = 864e5;

/**
 * A valid learning state (the shape of `initialLearnState()`) in which the given hiragana are
 * unlocked, introduced, in box 1 and confident: ten fast, correct recall answers each.
 */
export function learnStateWith(kana: readonly string[]): Record<string, unknown> {
  const keys = kana.map((k) => `hiragana:${k}`);
  const entries: Record<string, unknown> = {};
  const recent: Record<string, unknown> = {};
  for (const key of keys) {
    entries[key] = { box: 1, dueAt: Date.now() + 7 * DAY_MS, updatedAt: 1 };
    recent[key] = Array.from({ length: 10 }, (_, i) => ({ at: i + 1, ms: 800, ok: true }));
  }
  return {
    unlocked: {
      hiragana: keys,
      katakana: ['katakana:ア', 'katakana:イ', 'katakana:ウ', 'katakana:エ', 'katakana:オ'],
    },
    entries,
    recent,
    stats: {},
    activeDays: [],
    recallBuckets: { hiragana: {}, katakana: {} },
  };
}
