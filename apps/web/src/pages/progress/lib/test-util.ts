import { LOG_PAGE_EVENTS, encodePage } from '@nekotype/shared/runtime';
import { describe, foldLog } from '@nekotype/model';
import type { LearnView } from '@nekotype/model';
import type { LogEvent } from '@nekotype/shared/types';
import { answer, intro, start } from '@nekotype/model/testing';
import { getDatabase } from '@/shared/lib';
import { dayStart, keyOf } from '@/entities/learn';

const DEV = '018f0000-0000-7000-8000-0000000000a5';
const pad = (n: number): string => String(n).padStart(12, '0');

export type SeededDay = {
  readonly day: number;
  /** Recall answer times per track. */
  readonly hiragana?: readonly number[];
  readonly katakana?: readonly number[];
  /** Answers of other tasks (recognition). */
  readonly recognitions?: number;
};

/**
 * Tests only: writes a log of one device into the page's IndexedDB, as `/progress` reads it. Every
 * entry's answers fall at noon of its local day; the session starts and ends come first.
 */
export async function seedStatsLog(
  days: readonly SeededDay[],
  sessions: { readonly started: number; readonly finished: number } = { started: 0, finished: 0 },
): Promise<void> {
  const tz = -new Date().getTimezoneOffset();
  const noon = (day: number): number => dayStart(day) + 12 * 3_600_000;
  const first = Math.min(...days.map((d) => d.day));
  const events: LogEvent[] = [];
  const base = Number.isFinite(first) ? noon(first) : 0;
  for (let i = 0; i < sessions.started; i++) events.push(start(tz, { at: base }));
  for (let i = 0; i < sessions.finished; i++) events.push({ at: base, dev: DEV, n: 0, t: 'end' });
  const hira = keyOf('hiragana', 'あ');
  const kata = keyOf('katakana', 'ア');
  for (const { day, hiragana = [], katakana = [], recognitions = 0 } of days) {
    const at = noon(day);
    for (const ms of hiragana) events.push(answer(hira, { at, ms }));
    for (const ms of katakana) events.push(answer(kata, { at, ms }));
    for (let i = 0; i < recognitions; i++) events.push(answer(hira, { at, task: 'recognition' }));
  }
  const numbered = events.map((event, index) => ({ ...event, dev: DEV, n: index + 1 }));
  const db = await getDatabase();
  for (let from = 0; from < numbered.length; from += LOG_PAGE_EVENTS) {
    const chunk = numbered.slice(from, from + LOG_PAGE_EVENTS);
    const closed = chunk.length === LOG_PAGE_EVENTS;
    await db.put('log', closed ? `own:${pad(from + 1)}` : 'own:open', encodePage(chunk));
  }
  await db.put('meta', 'log', {
    dev: DEV,
    next: numbered.length + 1,
    lastAt: numbered.at(-1)?.at ?? 0,
  });
}

export { answer, intro };

/** Tests only: numbers the events of one device and folds them into a view. */
export function viewOfEvents(events: readonly LogEvent[]): LearnView {
  const numbered = events.map((event, index) => ({ ...event, dev: 'd1', n: index + 1 }));
  const snapshot = foldLog(numbered, { stats: true }).snapshot();
  if (snapshot.stats === null) throw new Error('the fold has no statistics');
  return describe(snapshot.state, snapshot.stats);
}

/** An introduction and five fast, correct recalls 40 s apart: the kana is learned at the end. */
export function learnedEvents(kana: string, at: number): LogEvent[] {
  const key = keyOf('hiragana', kana);
  return [
    intro(key, { at }),
    ...Array.from({ length: 5 }, (_, i) => answer(key, { at: at + 40_000 * (i + 1), ms: 900 })),
  ];
}
