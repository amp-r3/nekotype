import type { ValidTestConfig, ValidSettings, ValidKanaStats, ValidProgress } from './types';
import { isObject } from './object';

export function isTestConfig(value: unknown): value is ValidTestConfig {
  if (!isObject(value)) return false;

  if (value['kind'] === 'time') {
    const s = value['seconds'];
    return s === 15 || s === 30 || s === 60 || s === 120;
  }

  if (value['kind'] === 'count') {
    const p = value['prompts'];
    return p === 10 || p === 25 || p === 50 || p === 100;
  }

  if (value['kind'] === 'zen') return true;

  return false;
}

function isTypingSettings(value: unknown): value is ValidSettings['typing'] {
  if (!isObject(value)) return false;
  const script = value['script'];
  if (script !== 'hiragana' && script !== 'katakana' && script !== 'both') return false;
  const content = value['content'];
  if (content !== 'words' && content !== 'phrases') return false;
  const strictness = value['strictness'];
  if (strictness !== 'learner' && strictness !== 'ime') return false;
  if (typeof value['weakFocus'] !== 'boolean') return false;
  if (typeof value['showTranslation'] !== 'boolean') return false;
  return isTestConfig(value['test']);
}

function isLearnSettings(value: unknown): value is ValidSettings['learn'] {
  if (!isObject(value)) return false;
  const strictness = value['strictness'];
  if (strictness !== 'learner' && strictness !== 'ime') return false;
  const track = value['track'];
  if (track !== 'hiragana' && track !== 'katakana') return false;
  const ms = value['targetMs'];
  if (typeof ms !== 'number' || !Number.isInteger(ms) || ms < 1000 || ms > 3000) return false;
  if (ms % 250 !== 0) return false;
  return typeof value['sound'] === 'boolean';
}

export function isSettings(value: unknown): value is ValidSettings {
  if (!isObject(value)) return false;
  const updatedAt = value['updatedAt'];
  if (typeof updatedAt !== 'number' || !Number.isFinite(updatedAt)) return false;
  return isTypingSettings(value['typing']) && isLearnSettings(value['learn']);
}

export function isKanaStats(value: unknown): value is ValidKanaStats {
  if (!isObject(value)) return false;
  return (
    typeof value['a'] === 'number' &&
    typeof value['m'] === 'number' &&
    typeof value['t'] === 'number'
  );
}

export function isProgress(value: unknown): value is ValidProgress {
  if (!isObject(value)) return false;
  if (value['v'] !== 1) return false;

  const stats = value['stats'];
  if (!isObject(stats)) return false;

  for (const key of Object.keys(stats)) {
    if (!isKanaStats(stats[key])) {
      return false;
    }
  }

  return true;
}

export { isObject };

// The learning state's guards and merge rules are a module of their own: the first screen does not
// need them, so they stay out of the chunk it shares with the lazy screens.
export {
  RECENT_ANSWERS,
  isLearnKanaKey,
  isRecallAnswer,
  isLearnEntry,
  isLearnStat,
  isActiveDays,
  isLearnState,
  isCounters,
  mergeUnlocked,
  mergeRecent,
  mergeEntry,
  mergeEntries,
  addCounters,
  addLearnStats,
  mergeActiveDays,
  BUCKET_MS,
  MAX_BUCKET,
  BUCKET_DAYS,
  bucketOf,
  dropOldDays,
  addBuckets,
  RECOGNITION_DECAY_AT,
  decayLearnStat,
} from './learn-runtime';
