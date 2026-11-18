import type { Outbox, TestResult } from '@nekotype/shared/types';
import {
  isCounters,
  isKanaStats,
  isLearnState,
  isObject,
  isOutbox,
  isSettings,
  isTestResult,
} from '@nekotype/shared/runtime';
import type { LearnChanges, TypingChanges } from './build-batch';

/** `delta/learn`, or null when the record is absent or fails validation (ADR 061). */
export function readLearnChanges(value: unknown): LearnChanges | null {
  if (isObject(value) && isLearnState(value['learn']) && isCounters(value['counters'])) {
    return { learn: value['learn'], counters: value['counters'] };
  }
  return null;
}

/** `delta/typing`, or null. */
export function readTypingChanges(value: unknown): TypingChanges | null {
  if (isObject(value) && isKanaStats(value['kanaStats']) && isCounters(value['counters'])) {
    return { kanaStats: value['kanaStats'], counters: value['counters'] };
  }
  return null;
}

/**
 * `outbox/current` checked for everything the engine sends: the stores check the delta they read,
 * the engine also the identity, the settings and the results of the request.
 */
export function readOutbox(value: unknown): Outbox | null {
  if (!isOutbox(value)) return null;
  const { request, resultIds } = value;
  const settings = request.delta.settings;
  const valid =
    typeof request.deviceId === 'string' &&
    request.seq === value.seq &&
    (settings === null || isSettings(settings)) &&
    request.results.every(isTestResult) &&
    resultIds.every((id) => typeof id === 'string');
  return valid ? value : null;
}

/** A row of `results`: the result and whether the server has it. Null for a row that is not a result. */
export function readResultRow(value: unknown): { result: TestResult; synced: boolean } | null {
  if (!isObject(value)) return null;
  const { synced, ...result } = value;
  return isTestResult(result) ? { result, synced: synced === 1 } : null;
}
