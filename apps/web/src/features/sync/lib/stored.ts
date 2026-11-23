import type { SyncRequest } from '@nekotype/shared/types';
import { SYNC_FORMAT_VERSION, isLogPage, isObject, isSettings } from '@nekotype/shared/runtime';

/** `outbox/current`: the one batch built and not acknowledged yet (storage-sync.md, "Batches"). */
export type PendingBatch = {
  readonly seq: number;
  readonly request: SyncRequest;
};

const isCount = (value: unknown): value is number =>
  typeof value === 'number' && Number.isSafeInteger(value) && value >= 0;

/** `outbox/current` checked for everything the engine sends; null when absent or invalid (ADR 061). */
export function readOutbox(value: unknown): PendingBatch | null {
  if (!isObject(value)) return null;
  const outerSeq = value['seq'];
  const request = value['request'];
  if (!isCount(outerSeq) || !isObject(request)) return null;
  const { v, deviceId, seq, after, log, settings } = request;
  if (v !== SYNC_FORMAT_VERSION || typeof deviceId !== 'string' || seq !== outerSeq) return null;
  if (!isCount(after)) return null;
  if (log !== null && !isLogPage(log)) return null;
  if (settings !== null && !isSettings(settings)) return null;
  return { seq: outerSeq, request: { v, deviceId, seq: outerSeq, after, log, settings } };
}

/** The `n` of the last event of a batch; null for a batch without events. */
export function lastNOf(request: SyncRequest): number | null {
  return request.log === null ? null : request.log.n0 + request.log.e.length - 1;
}
