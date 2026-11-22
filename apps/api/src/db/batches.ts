import type { ValidSettings } from '@nekotype/shared/types';
import { corrupt, isRow, numberOf, textOf } from './rows';
import type { Row } from './rows';

// The statements of sync format 3: the only place with its SQL (P7 plan, D12, D13). The server
// stores a batch as one row of `sync_batches` and never parses its events (ADR 100, point 7).

/** Rows one page of a pull walks, own rows included. */
export const PULL_PAGE_ROWS = 100;
/** Bytes of the `log` texts one page of a pull holds; the first row is always taken. */
export const PULL_PAGE_BYTES = 256 * 1024;

/** The stored `user_stats` columns that a batch reads, and whether other devices have rows to pull. */
export interface BatchRead {
  readonly deviceSeq: unknown;
  readonly lastSyncAt: number;
  readonly version: number;
  /** Other devices wrote rows after the request's `after`. */
  readonly more: boolean;
}

function quoted(key: string): string {
  return `"${key}"`;
}

/** The path of one device's last `seq` in `device_seq`; the id is a UUID, so it needs no escaping. */
function seqPath(deviceId: string): string {
  return `$.${quoted(deviceId)}.seq`;
}

function parseJson(text: string | null, column: string): unknown {
  if (text === null) return null;
  try {
    return JSON.parse(text);
  } catch {
    throw corrupt('user_stats', column);
  }
}

/** Step 1: one statement. `null` when the user has no `user_stats` row. */
export async function readForBatch(
  db: D1Database,
  userId: string,
  deviceId: string,
  after: number,
): Promise<BatchRead | null> {
  const row = await db
    .prepare(
      `SELECT device_seq, last_sync_at, version,
         EXISTS (SELECT 1 FROM sync_batches WHERE user_id = ?1 AND id > ?2 AND device_id <> ?3) AS more
       FROM user_stats WHERE user_id = ?1`,
    )
    .bind(userId, after, deviceId)
    .first();
  if (!isRow(row)) return null;
  const lastSyncAt = numberOf(row, 'last_sync_at');
  const version = numberOf(row, 'version');
  if (lastSyncAt === null) throw corrupt('user_stats', 'last_sync_at');
  if (version === null) throw corrupt('user_stats', 'version');
  return {
    deviceSeq: parseJson(textOf(row, 'device_seq'), 'device_seq'),
    lastSyncAt,
    version,
    more: numberOf(row, 'more') === 1,
  };
}

export interface SettingsWrite {
  readonly json: string;
  readonly updatedAt: number;
  /** The first batch of a device keeps the account's settings (`mergeSettings`). */
  readonly keepStored: boolean;
}

/** The upsert of the settings: the newer `updatedAt` wins; idempotent, so a lost attempt is harmless. */
export function settingsStatement(
  db: D1Database,
  userId: string,
  { json, updatedAt, keepStored }: SettingsWrite,
): D1PreparedStatement {
  return db
    .prepare(
      keepStored
        ? 'INSERT OR IGNORE INTO user_settings (user_id, json, updated_at) VALUES (?1, ?2, ?3)'
        : `INSERT INTO user_settings (user_id, json, updated_at) VALUES (?1, ?2, ?3)
           ON CONFLICT(user_id) DO UPDATE SET json = excluded.json, updated_at = excluded.updated_at
           WHERE excluded.updated_at > user_settings.updated_at`,
    )
    .bind(userId, json, updatedAt);
}

/** What step 3 writes. */
export interface BatchWrite {
  readonly userId: string;
  readonly deviceId: string;
  readonly seq: number;
  /** The `version` that was read; the `UPDATE` applies only to it. */
  readonly version: number;
  readonly now: number;
  readonly deviceSeq: string;
  /** The `LogPage` as JSON text, or null. */
  readonly log: string | null;
  readonly settings: SettingsWrite | null;
}

/**
 * Step 3: one `batch()`. The `UPDATE` is guarded by `version`; the insert of the batch runs only
 * when that `UPDATE` applied: the version is the one the `UPDATE` writes and this device's `seq`
 * in `device_seq` is the batch's, which a request that lost the race cannot show (a competing write
 * that raised the version did not write this `seq`). Resolves to whether the `UPDATE` applied.
 */
export async function writeBatch(db: D1Database, write: BatchWrite): Promise<boolean> {
  const statements = [
    db
      .prepare(
        `UPDATE user_stats SET device_seq = ?2, last_sync_at = ?3, version = version + 1
         WHERE user_id = ?1 AND version = ?4`,
      )
      .bind(write.userId, write.deviceSeq, write.now, write.version),
  ];
  if (write.log !== null) {
    statements.push(
      db
        .prepare(
          `INSERT INTO sync_batches (user_id, id, device_id, seq, log, created_at)
           SELECT ?1, next, ?2, ?3, ?4, ?5
           FROM (SELECT COALESCE(MAX(id), 0) + 1 AS next FROM sync_batches WHERE user_id = ?1)
           WHERE EXISTS (
             SELECT 1 FROM user_stats
             WHERE user_id = ?1 AND version = ?6 AND json_extract(device_seq, ?7) = ?3
           )`,
        )
        .bind(
          write.userId,
          write.deviceId,
          write.seq,
          write.log,
          write.now,
          write.version + 1,
          seqPath(write.deviceId),
        ),
    );
  }
  if (write.settings !== null) statements.push(settingsStatement(db, write.userId, write.settings));
  const written = await db.batch(statements);
  return (written[0]?.meta.changes ?? 0) > 0;
}

// `GET /api/sync?deviceId=&after=`

/**
 * One page of a pull as a JSON string, put together from the stored texts and never parsed. Rows
 * of `deviceId` are walked and skipped; the others are added while their texts total at most
 * `PULL_PAGE_BYTES`, and at least one is always added.
 */
export async function readPull(
  db: D1Database,
  userId: string,
  deviceId: string,
  after: number,
): Promise<string> {
  const [rowsRead, settingsRead] = await db.batch([
    db
      .prepare(
        `SELECT id, device_id, log, LENGTH(CAST(log AS BLOB)) AS bytes FROM sync_batches
         WHERE user_id = ?1 AND id > ?2 ORDER BY id LIMIT ?3`,
      )
      .bind(userId, after, PULL_PAGE_ROWS + 1),
    db.prepare('SELECT json FROM user_settings WHERE user_id = ?1').bind(userId),
  ]);

  const rows: Row[] = (rowsRead?.results ?? []).filter(isRow);
  const settings = firstText(settingsRead?.results ?? [], 'json');
  const parts: string[] = [];
  let last = after;
  let bytes = 0;
  let walked = 0;
  for (const row of rows.slice(0, PULL_PAGE_ROWS)) {
    const id = numberOf(row, 'id');
    const owner = textOf(row, 'device_id');
    const log = textOf(row, 'log');
    const size = numberOf(row, 'bytes');
    if (id === null || owner === null || log === null || size === null) {
      throw corrupt('sync_batches', 'row');
    }
    if (owner !== deviceId) {
      if (parts.length > 0 && bytes + size > PULL_PAGE_BYTES) break;
      parts.push(`{"id":${id},"log":${log}}`);
      bytes += size;
    }
    last = id;
    walked += 1;
  }
  const more = rows.length > walked;
  return `{"last":${last},"more":${more},"settings":${settings ?? 'null'},"rows":[${parts.join(',')}]}`;
}

function firstText(results: readonly unknown[], column: string): string | null {
  const first = results[0];
  return isRow(first) ? textOf(first, column) : null;
}

/** The settings of a request as the statement needs them. */
export function settingsWrite(settings: ValidSettings, keepStored: boolean): SettingsWrite {
  return { json: JSON.stringify(settings), updatedAt: settings.updatedAt, keepStored };
}
