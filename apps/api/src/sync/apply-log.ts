import { isObject } from '@nekotype/shared/runtime';
import type { SyncRequest, SyncResponse } from '@nekotype/shared/types';
import { readForBatch, settingsWrite, writeBatch } from '../db/batches';
import { corrupt } from '../db/rows';

// The server side of a sync of format 3 (P7 plan, D12): the `seq` rule, the rate limit, the
// `device_seq` bookkeeping and one row per batch. The log is stored as received and never parsed
// beyond the guard of the schema; the server never computes a state.

const DAY_MS = 24 * 60 * 60 * 1000;
/** `device_seq` entries not updated for 90 days are removed on the next write (storage-sync.md, Batches). */
const DEVICE_SEQ_TTL_MS = 90 * DAY_MS;

export type LogOutcome =
  | { readonly kind: 'ok'; readonly response: SyncResponse }
  /** `seq` > last + 1. */
  | { readonly kind: 'gap'; readonly lastSeq: number }
  /** The interval since the last applied sync has not elapsed. */
  | { readonly kind: 'limited'; readonly retryAfterSeconds: number }
  /** Another request won the version twice. */
  | { readonly kind: 'conflict' };

export interface LogOptions {
  readonly now: number;
  /** Milliseconds between two applied batches of one user. */
  readonly minIntervalMs: number;
}

type DeviceSeq = Record<string, { seq: number; at: number }>;

function isDeviceSeq(value: unknown): value is DeviceSeq {
  return (
    isObject(value) &&
    Object.values(value).every(
      (entry) =>
        isObject(entry) &&
        typeof entry['seq'] === 'number' &&
        Number.isInteger(entry['seq']) &&
        typeof entry['at'] === 'number',
    )
  );
}

/**
 * Applies one batch (steps 1–5). A write that loses the `version` race is repeated once from the
 * read; losing twice is a `conflict`. The caller has validated the request and checked the session.
 */
export async function applyLog(
  db: D1Database,
  userId: string,
  request: SyncRequest,
  options: LogOptions,
): Promise<LogOutcome> {
  for (let attempt = 0; attempt < 2; attempt += 1) {
    const row = await readForBatch(db, userId, request.deviceId, request.after);
    if (row === null) throw corrupt('user_stats', 'user_id');
    if (!isDeviceSeq(row.deviceSeq)) throw corrupt('user_stats', 'device_seq');
    const lastSeq = row.deviceSeq[request.deviceId]?.seq ?? 0;
    // `seq` ≤ last: the batch is already applied. Answered like an applied one, and not limited,
    // because it writes nothing.
    if (request.seq <= lastSeq) {
      return { kind: 'ok', response: { lastSeq, more: row.more } };
    }
    if (request.seq > lastSeq + 1) return { kind: 'gap', lastSeq };
    const wait = row.lastSyncAt + options.minIntervalMs - options.now;
    if (wait > 0) return { kind: 'limited', retryAfterSeconds: Math.ceil(wait / 1000) };

    // `device_seq`: this device, and the others that are not stale.
    const deviceSeq: DeviceSeq = {};
    for (const [id, entry] of Object.entries(row.deviceSeq)) {
      if (options.now - entry.at <= DEVICE_SEQ_TTL_MS) deviceSeq[id] = entry;
    }
    deviceSeq[request.deviceId] = { seq: request.seq, at: options.now };

    const applied = await writeBatch(db, {
      userId,
      deviceId: request.deviceId,
      seq: request.seq,
      version: row.version,
      now: options.now,
      deviceSeq: JSON.stringify(deviceSeq),
      log: request.log === null ? null : JSON.stringify(request.log),
      settings:
        request.settings === null ? null : settingsWrite(request.settings, request.seq === 1),
    });
    if (applied) return { kind: 'ok', response: { lastSeq: request.seq, more: row.more } };
  }
  return { kind: 'conflict' };
}
