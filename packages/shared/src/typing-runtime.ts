import type { KanaStat, TestResult, TypingRecordEntry, TypingRecords } from './types';
import { isObject } from './object';

// Typing: personal-best rules, records, kana statistics and guards. The client applies them to its
// local view and the server applies the same ones (spec metrics.md, "Data model").

/** How many results per key are kept for the average. */
export const RECENT_RESULTS = 10;

/** A result below this kana accuracy gives no personal best (A3). */
export const BEST_MIN_ACCURACY = 0.8;

/** A kana whose attempts pass this has both counters halved (A8). */
export const KANA_DECAY_AT = 200;

/** KPM is stored rounded to 0.1 (T3). */
export function roundKpm(kpm: number): number {
  return Math.round(kpm * 10) / 10;
}

/** Kana accuracy is a fraction stored rounded to 4 decimals (T3). */
export function roundAccuracy(accuracy: number): number {
  return Math.round(accuracy * 10000) / 10000;
}

type KeyParts = Pick<TestResult, 'content' | 'script' | 'strictness' | 'config'>;

/** `content|script|strictness|config`, e.g. `words|hiragana|learner|time:60`. */
export function personalBestKey(parts: KeyParts): string {
  const { config } = parts;
  const mode =
    config.kind === 'time'
      ? `time:${config.seconds}`
      : config.kind === 'count'
        ? `count:${config.prompts}`
        : 'zen';
  return `${parts.content}|${parts.script}|${parts.strictness}|${mode}`;
}

type Eligibility = Pick<TestResult, 'endReason' | 'repeated' | 'kanaAccuracy'>;

export function isBestEligible(result: Eligibility): boolean {
  return (
    result.endReason === 'complete' && !result.repeated && result.kanaAccuracy >= BEST_MIN_ACCURACY
  );
}

/** The mean KPM of `recent`; null with no earlier result. */
export function averageKpm(entry: TypingRecordEntry | undefined): number | null {
  if (entry === undefined || entry.recent.length === 0) return null;
  let sum = 0;
  for (const item of entry.recent) sum += item.kpm;
  return sum / entry.recent.length;
}

export type ResultApplied = {
  readonly records: TypingRecords;
  /** The average before the result; null with no earlier result. */
  readonly average: number | null;
  /** The best KPM before the result; null if there was none. */
  readonly previousBest: number | null;
  /** The result set a new best. */
  readonly isBest: boolean;
};

type Recent = TypingRecordEntry['recent'][number];

function oldestFirst(a: Recent, b: Recent): number {
  if (a.endedAt !== b.endedAt) return a.endedAt - b.endedAt;
  return a.resultId < b.resultId ? -1 : a.resultId > b.resultId ? 1 : 0;
}

/**
 * Adds a result to the records. Average and previous best are the values before the result. A
 * repeat changes nothing; any other result joins `recent` (the 10 latest by `endedAt`, then id).
 */
export function applyResultToRecords(records: TypingRecords, result: TestResult): ResultApplied {
  const key = personalBestKey(result);
  const entry = records[key];
  const average = averageKpm(entry);
  const previousBest = entry?.best?.kpm ?? null;
  if (result.repeated) return { records, average, previousBest, isBest: false };

  const joined: Recent = { resultId: result.id, endedAt: result.endedAt, kpm: result.kpm };
  const recent = [...(entry?.recent ?? []).filter((r) => r.resultId !== result.id), joined]
    .sort(oldestFirst)
    .slice(-RECENT_RESULTS);
  const isBest = isBestEligible(result) && (previousBest === null || result.kpm > previousBest);
  const best = isBest ? { kpm: result.kpm, resultId: result.id } : (entry?.best ?? null);
  return { records: { ...records, [key]: { best, recent } }, average, previousBest, isBest };
}

export function addKanaStats(a: KanaStat | undefined, b: KanaStat): KanaStat {
  return {
    attempts: (a?.attempts ?? 0) + b.attempts,
    erroredAttempts: (a?.erroredAttempts ?? 0) + b.erroredAttempts,
  };
}

/** Halves both counters of a kana whose attempts pass 200, rounding down. */
export function decayKanaStat(stat: KanaStat): KanaStat {
  if (stat.attempts <= KANA_DECAY_AT) return stat;
  return {
    attempts: Math.floor(stat.attempts / 2),
    erroredAttempts: Math.floor(stat.erroredAttempts / 2),
  };
}

function isCount(value: unknown): value is number {
  return typeof value === 'number' && Number.isInteger(value) && value >= 0;
}

function isFiniteNumber(value: unknown): value is number {
  return typeof value === 'number' && Number.isFinite(value);
}

export function isKanaStat(value: unknown): value is KanaStat {
  return (
    isObject(value) &&
    isCount(value['attempts']) &&
    isCount(value['erroredAttempts']) &&
    value['erroredAttempts'] <= value['attempts']
  );
}

function isResultConfig(value: unknown): value is TestResult['config'] {
  if (!isObject(value)) return false;
  if (value['kind'] === 'time') return isCount(value['seconds']) && value['seconds'] > 0;
  if (value['kind'] === 'count') return isCount(value['prompts']) && value['prompts'] > 0;
  return value['kind'] === 'zen';
}

export function isTestResult(value: unknown): value is TestResult {
  if (!isObject(value)) return false;
  const content = value['content'];
  if (content !== 'words' && content !== 'phrases') return false;
  const script = value['script'];
  if (script !== 'hiragana' && script !== 'katakana' && script !== 'both') return false;
  const strictness = value['strictness'];
  if (strictness !== 'learner' && strictness !== 'ime') return false;
  const endReason = value['endReason'];
  if (
    endReason !== 'complete' &&
    endReason !== 'manual' &&
    endReason !== 'idle' &&
    endReason !== 'hidden'
  ) {
    return false;
  }
  const accuracy = value['kanaAccuracy'];
  const kpm = value['kpm'];
  return (
    typeof value['id'] === 'string' &&
    value['id'] !== '' &&
    isResultConfig(value['config']) &&
    typeof value['repeated'] === 'boolean' &&
    isFiniteNumber(value['startedAt']) &&
    isFiniteNumber(value['endedAt']) &&
    isCount(value['durationMs']) &&
    isCount(value['tokens']) &&
    isCount(value['erroredTokens']) &&
    value['erroredTokens'] <= value['tokens'] &&
    isCount(value['items']) &&
    isCount(value['keystrokes']) &&
    isCount(value['rejectedKeystrokes']) &&
    isCount(value['assisted']) &&
    isFiniteNumber(kpm) &&
    kpm >= 0 &&
    isFiniteNumber(accuracy) &&
    accuracy >= 0 &&
    accuracy <= 1 &&
    typeof value['celebratedPersonalBest'] === 'boolean' &&
    typeof value['contentVersion'] === 'string' &&
    typeof value['appVersion'] === 'string'
  );
}

function isRecentItem(value: unknown): value is Recent {
  return (
    isObject(value) &&
    typeof value['resultId'] === 'string' &&
    isFiniteNumber(value['endedAt']) &&
    isFiniteNumber(value['kpm']) &&
    value['kpm'] >= 0
  );
}

export function isTypingRecordEntry(value: unknown): value is TypingRecordEntry {
  if (!isObject(value)) return false;
  const best = value['best'];
  if (best !== null) {
    if (!isObject(best)) return false;
    if (!isFiniteNumber(best['kpm']) || best['kpm'] < 0) return false;
    if (typeof best['resultId'] !== 'string') return false;
  }
  const recent = value['recent'];
  return Array.isArray(recent) && recent.length <= RECENT_RESULTS && recent.every(isRecentItem);
}

export function isTypingRecords(value: unknown): value is TypingRecords {
  if (!isObject(value)) return false;
  return Object.keys(value).every((key) => isTypingRecordEntry(value[key]));
}
