import type { Outbox } from '@nekotype/shared/types';
import { isCounters, isLearnState, isObject, isOutbox, isSettings } from '@nekotype/shared/runtime';
import type { LearnChanges } from './build-batch';

/** `delta/learn`, or null when the record is absent or fails validation (ADR 061). */
export function readLearnChanges(value: unknown): LearnChanges | null {
  if (isObject(value) && isLearnState(value['learn']) && isCounters(value['counters'])) {
    return { learn: value['learn'], counters: value['counters'] };
  }
  return null;
}

/**
 * `outbox/current` checked for everything the engine sends: the stores check the delta they read,
 * the engine also the identity and the settings of the request.
 */
export function readOutbox(value: unknown): Outbox | null {
  if (!isOutbox(value)) return null;
  const { request } = value;
  const settings = request.delta.settings;
  const valid =
    typeof request.deviceId === 'string' &&
    request.seq === value.seq &&
    (settings === null || isSettings(settings));
  return valid ? value : null;
}
