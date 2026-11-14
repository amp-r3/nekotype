import type { TestResult, TypingRecords } from '@nekotype/shared/types';
import { personalBestKey } from '@nekotype/shared/runtime';
import type { ModeParts } from '@/entities/stats';

/** Rows of the history per page (T12). */
export const HISTORY_PAGE_SIZE = 10;

/** Reads saved results, newest first. */
export type ReadResults = (offset: number, limit: number) => Promise<TestResult[]>;

function positiveInt(text: string | undefined): number | null {
  if (text === undefined || !/^[1-9]\d*$/.test(text)) return null;
  return Number(text);
}

function parseConfig(mode: string): TestResult['config'] | null {
  if (mode === 'zen') return { kind: 'zen' };
  const [kind, amount, ...rest] = mode.split(':');
  const n = positiveInt(amount);
  if (n === null || rest.length > 0) return null;
  if (kind === 'time') return { kind: 'time', seconds: n };
  if (kind === 'count') return { kind: 'count', prompts: n };
  return null;
}

/** The parts of a `personalBestKey()` (`words|hiragana|learner|time:60`); null for anything else. */
export function parseBestKey(key: string): ModeParts | null {
  const [content, script, strictness, mode, ...rest] = key.split('|');
  if (mode === undefined || rest.length > 0) return null;
  if (content !== 'words' && content !== 'phrases') return null;
  if (script !== 'hiragana' && script !== 'katakana' && script !== 'both') return null;
  if (strictness !== 'learner' && strictness !== 'ime') return null;
  const config = parseConfig(mode);
  return config === null ? null : { content, script, strictness, config };
}

export type BestRow = {
  readonly key: string;
  readonly label: string;
  /** As shown: a whole number. */
  readonly kpm: number;
};

/** Every key with a personal best, labelled by `label` and sorted by the label (T13). */
export function bestRows(records: TypingRecords, label: (parts: ModeParts) => string): BestRow[] {
  const rows: BestRow[] = [];
  for (const [key, entry] of Object.entries(records)) {
    const parts = parseBestKey(key);
    if (parts === null || entry.best === null) continue;
    rows.push({ key, label: label(parts), kpm: Math.round(entry.best.kpm) });
  }
  return rows.sort((a, b) => a.label.localeCompare(b.label) || (a.key < b.key ? -1 : 1));
}

export function historyPages(count: number): number {
  return Math.max(1, Math.ceil(count / HISTORY_PAGE_SIZE));
}

export type HistoryRow = {
  readonly id: string;
  readonly endedAt: number;
  readonly content: TestResult['content'];
  readonly config: TestResult['config'];
  readonly repeated: boolean;
  /** As shown: a whole number. */
  readonly kpm: number;
  /** Whole percent. */
  readonly accuracy: number;
  /** Seconds, to 0.1. */
  readonly seconds: number;
  /** The result is the current personal best of its key. */
  readonly best: boolean;
};

export function historyRow(result: TestResult, records: TypingRecords): HistoryRow {
  return {
    id: result.id,
    endedAt: result.endedAt,
    content: result.content,
    config: result.config,
    repeated: result.repeated,
    kpm: Math.round(result.kpm),
    accuracy: Math.round(result.kanaAccuracy * 100),
    seconds: Math.round(result.durationMs / 100) / 10,
    best: records[personalBestKey(result)]?.best?.resultId === result.id,
  };
}
