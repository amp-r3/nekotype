import { isLogPage } from './log-codec';
import { isObject } from './object';
import { readSettings } from './settings-runtime';
import { isCount } from './sync-format';
import type { PullResponse, PulledRow, SyncResponse, ValidSettings } from './types';

// Constants and guards of the sync (spec backend.md, "Request and response bodies").

/** The body of a sync request, bytes (backend.md, "Sync request limits"). */
export const MAX_SYNC_BODY_BYTES = 256 * 1024;

/** The answer of `POST /api/sync` in format 4 (P7 plan, D12). */
export function isSyncResponse(value: unknown): value is SyncResponse {
  return isObject(value) && isCount(value['lastSeq']) && typeof value['more'] === 'boolean';
}

/**
 * One page of `GET /api/sync?after=` (P7 plan, D12), or null when it is not one: every row is a
 * valid log page. Its settings are read by `readSettings`, so a document of an earlier version
 * comes back in the current form.
 */
export function readPullResponse(value: unknown): PullResponse | null {
  if (!isObject(value)) return null;
  const { last, more, rows } = value;
  if (!isCount(last) || typeof more !== 'boolean' || !Array.isArray(rows)) return null;
  const settings = value['settings'] === null ? null : readSettings(value['settings']);
  if (settings === null && value['settings'] !== null) return null;
  const pulled: PulledRow[] = [];
  for (const row of rows) {
    if (!isObject(row) || !isCount(row['id']) || !isLogPage(row['log'])) return null;
    pulled.push({ id: row['id'], log: row['log'] });
  }
  return { last, more, settings, rows: pulled };
}

/** Settings: last write wins on `updatedAt`; the first batch of a sign-in (`seq` 1) yields to the account's. */
export function mergeSettings(
  stored: ValidSettings | null,
  incoming: ValidSettings | null,
  seq: number,
): ValidSettings | null {
  if (incoming === null) return stored;
  if (stored === null) return incoming;
  if (seq === 1) return stored;
  return incoming.updatedAt > stored.updatedAt ? incoming : stored;
}
