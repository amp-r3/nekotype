import type { SyncRequest } from '@nekotype/shared/types';
import { SYNC_FORMAT_VERSION, isLogPage, isObject, readSettings } from '@nekotype/shared/runtime';

/** `outbox/current`: the one batch built and not acknowledged yet (storage-sync.md, "Batches"). */
export type PendingBatch = {
  readonly seq: number;
  readonly request: SyncRequest;
};

const isCount = (value: unknown): value is number =>
  typeof value === 'number' && Number.isSafeInteger(value) && value >= 0;

/**
 * `outbox/current` checked for everything the engine sends; null when absent or invalid (ADR 061).
 * Settings of an earlier version are read by `readSettings`.
 */
export function readOutbox(value: unknown): PendingBatch | null {
  if (!isObject(value)) return null;
  const outerSeq = value['seq'];
  const request = value['request'];
  if (!isCount(outerSeq) || !isObject(request)) return null;
  const { v, deviceId, seq, after, log, settings } = request;
  if (v !== SYNC_FORMAT_VERSION || typeof deviceId !== 'string' || seq !== outerSeq) return null;
  if (!isCount(after)) return null;
  if (log !== null && !isLogPage(log)) return null;
  // A batch of an earlier version is sent with its settings in the current form (ADR 115).
  const current = settings === null ? null : readSettings(settings);
  if (settings !== null && current === null) return null;
  return {
    seq: outerSeq,
    request: { v, deviceId, seq: outerSeq, after, log, settings: current },
  };
}

/** The `n` of the last event of a batch; null for a batch without events. */
export function lastNOf(request: SyncRequest): number | null {
  return request.log === null ? null : request.log.n0 + request.log.e.length - 1;
}
