import { isObject } from './object';

// The envelope of the sync format, apart from the guards of its content: the first screen reads
// the outbox through it without the snapshot guards (ADR 087).

/** The version of the batch format (`SyncRequest.v`). */
export const SYNC_FORMAT_VERSION = 2;

export function isCount(value: unknown): value is number {
  return typeof value === 'number' && Number.isInteger(value) && value >= 0;
}

/**
 * The delta of a stored batch (`outbox/current`), unchecked; null when the record is not a batch of
 * this format. A store checks the part of the delta it reads.
 */
export function outboxDelta(value: unknown): Readonly<Record<string, unknown>> | null {
  if (!isObject(value) || !isCount(value['seq'])) return null;
  const request = value['request'];
  if (!isObject(request) || request['v'] !== SYNC_FORMAT_VERSION) return null;
  const delta = request['delta'];
  return isObject(delta) ? delta : null;
}
