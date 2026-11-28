import { allKanaRows } from '@nekotype/engine';
import type { EventDraft } from '@nekotype/shared/types';

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

/**
 * The events of kana learned `ago` ms before now and due for review now: an introduction and five
 * fast, correct recalls 40 s apart for each (the fold graduates a kana at the fifth).
 */
export function learnedLog(kana: readonly string[], ago: number): EventDraft[] {
  const events: EventDraft[] = [];
  let at = Date.now() - ago;
  for (const k of kana) {
    const key = `hiragana:${k}` as const;
    events.push({ t: 'intro', at, k: key });
    for (let i = 0; i < 5; i++) {
      at += 40_000;
      events.push({
        t: 'answer',
        at,
        task: 'recall',
        k: key,
        ok: true,
        ms: 900,
        hint: false,
        wrong: null,
        alt: null,
        misses: 0,
        w: null,
      });
    }
  }
  return events;
}
