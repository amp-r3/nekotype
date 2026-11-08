import type { ValidTestConfig, ValidSettings, ValidKanaStats, ValidProgress } from './types';

export function isObject(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

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

export function isSettings(value: unknown): value is ValidSettings {
  if (!isObject(value)) return false;
  if (value['v'] !== 1) return false;

  const script = value['script'];
  if (script !== 'hiragana' && script !== 'katakana' && script !== 'both') {
    return false;
  }

  const content = value['content'];
  if (content !== 'words' && content !== 'phrases') {
    return false;
  }

  const strictness = value['strictness'];
  if (strictness !== 'learner' && strictness !== 'ime') {
    return false;
  }

  if (typeof value['weakFocus'] !== 'boolean') {
    return false;
  }

  const showTranslation = value['showTranslation'];
  if (showTranslation !== undefined && typeof showTranslation !== 'boolean') {
    return false;
  }

  return isTestConfig(value['test']);
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
