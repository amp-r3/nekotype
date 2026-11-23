import { isLogPage } from './log-codec';
import { isObject } from './object';
import { isSettings } from './settings-runtime';
import { isCount } from './sync-format';
import type { PullResponse, SyncResponse, ValidSettings } from './types';

// Constants and guards of the sync (spec backend.md, "Request and response bodies").

/** The body of a sync request, bytes (backend.md, "Sync request limits"). */
export const MAX_SYNC_BODY_BYTES = 256 * 1024;

/** The answer of `POST /api/sync` in format 3 (P7 plan, D12). */
export function isSyncResponse(value: unknown): value is SyncResponse {
  return isObject(value) && isCount(value['lastSeq']) && typeof value['more'] === 'boolean';
}

/** One page of `GET /api/sync?after=` (P7 plan, D12); every row is a valid log page. */
export function isPullResponse(value: unknown): value is PullResponse {
  if (
    !isObject(value) ||
    !isCount(value['last']) ||
    typeof value['more'] !== 'boolean' ||
    !isSettingsOrNull(value['settings']) ||
    !Array.isArray(value['rows'])
  ) {
    return false;
  }
  return value['rows'].every(
    (row: unknown) => isObject(row) && isCount(row['id']) && isLogPage(row['log']),
  );
}

function isSettingsOrNull(value: unknown): value is ValidSettings | null {
  return value === null || isSettings(value);
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
