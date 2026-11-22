import type { Track } from '@nekotype/shared/types';
import { settingsStatement } from './batches';
import type { SettingsWrite } from './batches';
import { corrupt, isRow, numberOf, textOf } from './rows';
import type { Row } from './rows';

// The statements of the sync: the only place with its SQL (p5-plan.md, D1, D7; ADR 082). A sync
// reads the small columns whole and the three large ones by path, and writes them with JSON Merge
// Patches, so its cost depends on the batch and not on the history.

/** D1 allows 100 bound parameters per query: the user, the unused first path and at most 98 paths. */
const MAX_PATHS = 98;
/**
 * `json_extract` with one path returns the bare value, with several an array. A first path that
 * never exists keeps the result an array whatever the number of paths.
 */
const NO_PATH = '$._';

const TRACKS: readonly Track[] = ['hiragana', 'katakana'];

/** The keys of one batch that the merge needs from the stored row. */
export interface ReadPlan {
  /** `delta.learn.entries` */
  readonly entries: readonly string[];
  /** `delta.learn.stats` */
  readonly stats: readonly string[];
  /** `delta.learn.recent` */
  readonly recent: readonly string[];
  /** The days of `delta.learn.recallBuckets` per track. */
  readonly days: Readonly<Record<Track, readonly string[]>>;
}

/** The stored row as far as a batch reads it; every value is `unknown` until a guard looks at it. */
export interface StoredRow {
  readonly counters: unknown;
  readonly deviceSeq: unknown;
  readonly bucketNewest: unknown;
  readonly lastSyncAt: number;
  readonly version: number;
  readonly unlocked: unknown;
  readonly activeDays: unknown;
  /** Per planned day, hiragana days first; `null` where the day is not stored. */
  readonly days: readonly unknown[];
  readonly recent: readonly unknown[];
  readonly entries: readonly unknown[];
  readonly stats: readonly unknown[];
}

function quoted(key: string): string {
  return `"${key}"`;
}

function parseJson(text: string | null, column: string): unknown {
  if (text === null) return null;
  try {
    return JSON.parse(text);
  } catch {
    throw corrupt('user_stats', column);
  }
}

/** `SELECT json_extract(column, ?2, ?3, …) AS found` in statements of at most 98 paths. */
function extractStatements(
  db: D1Database,
  userId: string,
  column: 'learn' | 'learn_recent',
  paths: readonly string[],
): D1PreparedStatement[] {
  const statements: D1PreparedStatement[] = [];
  for (let at = 0; at < paths.length; at += MAX_PATHS) {
    const chunk = [NO_PATH, ...paths.slice(at, at + MAX_PATHS)];
    const marks = chunk.map((_, index) => `?${index + 2}`).join(', ');
    statements.push(
      db
        .prepare(
          `SELECT json_extract(${column}, ${marks}) AS found FROM user_stats WHERE user_id = ?1`,
        )
        .bind(userId, ...chunk),
    );
  }
  return statements;
}

/** The values of the `found` results of a group of statements, without each one's unused first path. */
function extractedValues(rows: readonly (Row | null)[]): unknown[] {
  const values: unknown[] = [];
  for (const row of rows) {
    const parsed = parseJson(row === null ? null : textOf(row, 'found'), 'found');
    if (!Array.isArray(parsed)) continue;
    const list: readonly unknown[] = parsed;
    values.push(...list.slice(1));
  }
  return values;
}

function firstRow(results: readonly unknown[]): Row | null {
  const first = results[0];
  return isRow(first) ? first : null;
}

/** The days of the plan in the order of the read: hiragana, then katakana. */
export function plannedDays(plan: ReadPlan): { track: Track; day: string }[] {
  return TRACKS.flatMap((track) => plan.days[track].map((day) => ({ track, day })));
}

/**
 * Step 1 of "Applying a batch": one `batch()` of the small columns with the touched days, then the
 * touched kana of each large object. At the caps that is 4 statements. `null` when the user has no
 * `user_stats` row.
 */
export async function readForSync(
  db: D1Database,
  userId: string,
  plan: ReadPlan,
): Promise<StoredRow | null> {
  const dayPaths = [
    NO_PATH,
    ...plannedDays(plan).map(({ track, day }) => `$.${track}.${quoted(day)}`),
  ];
  const dayMarks = dayPaths.map((_, index) => `?${index + 2}`).join(', ');
  const recentReads = extractStatements(
    db,
    userId,
    'learn_recent',
    plan.recent.map((key) => `$.${quoted(key)}`),
  );
  const entryReads = extractStatements(
    db,
    userId,
    'learn',
    plan.entries.map((key) => `$.entries.${quoted(key)}`),
  );
  const statReads = extractStatements(
    db,
    userId,
    'learn',
    plan.stats.map((key) => `$.stats.${quoted(key)}`),
  );
  const read = await db.batch([
    db
      .prepare(
        `SELECT counters, device_seq, bucket_newest, last_sync_at, version,
           json_extract(learn, '$.unlocked') AS unlocked,
           json_extract(learn, '$.activeDays') AS active_days,
           json_extract(learn_buckets, ${dayMarks}) AS days
         FROM user_stats WHERE user_id = ?1`,
      )
      .bind(userId, ...dayPaths),
    ...recentReads,
    ...entryReads,
    ...statReads,
  ]);

  const row = firstRow(read[0]?.results ?? []);
  if (row === null) return null;
  const lastSyncAt = numberOf(row, 'last_sync_at');
  const version = numberOf(row, 'version');
  if (lastSyncAt === null) throw corrupt('user_stats', 'last_sync_at');
  if (version === null) throw corrupt('user_stats', 'version');

  const found = read.slice(1).map((result) => firstRow(result.results));
  const groups = {
    recent: found.slice(0, recentReads.length),
    entries: found.slice(recentReads.length, recentReads.length + entryReads.length),
    stats: found.slice(recentReads.length + entryReads.length),
  };
  const days = parseJson(textOf(row, 'days'), 'learn_buckets');
  const dayValues: readonly unknown[] = Array.isArray(days) ? days.slice(1) : [];
  return {
    counters: parseJson(textOf(row, 'counters'), 'counters'),
    deviceSeq: parseJson(textOf(row, 'device_seq'), 'device_seq'),
    bucketNewest: parseJson(textOf(row, 'bucket_newest'), 'bucket_newest'),
    lastSyncAt,
    version,
    unlocked: parseJson(textOf(row, 'unlocked'), 'learn'),
    activeDays: parseJson(textOf(row, 'active_days'), 'learn'),
    days: dayValues,
    recent: extractedValues(groups.recent),
    entries: extractedValues(groups.entries),
    stats: extractedValues(groups.stats),
  };
}

/** What step 3 writes. The columns are JSON text; a patch column is `null` when nothing changes. */
export interface SyncWrite {
  readonly userId: string;
  /** The `version` that was read; the `UPDATE` applies only to it. */
  readonly version: number;
  readonly now: number;
  readonly counters: string;
  readonly deviceSeq: string;
  readonly bucketNewest: string;
  readonly learnPatch: string;
  readonly recentPatch: string | null;
  readonly bucketsPatch: string | null;
  readonly settings: SettingsWrite | null;
}

/**
 * Step 3: one `batch()` with the `UPDATE` (guarded by `version`, nothing returned) and the settings.
 * Resolves to whether the `UPDATE` applied. A lost attempt still writes its settings, which is
 * harmless: the write is idempotent.
 */
export async function writeSync(db: D1Database, write: SyncWrite): Promise<boolean> {
  const assignments = [
    'counters = ?2',
    'device_seq = ?3',
    'bucket_newest = ?4',
    'learn = json_patch(learn, ?5)',
    'last_sync_at = ?6',
    'version = version + 1',
  ];
  const values: (string | number)[] = [
    write.userId,
    write.counters,
    write.deviceSeq,
    write.bucketNewest,
    write.learnPatch,
    write.now,
  ];
  if (write.recentPatch !== null) {
    values.push(write.recentPatch);
    assignments.push(`learn_recent = json_patch(learn_recent, ?${values.length})`);
  }
  if (write.bucketsPatch !== null) {
    values.push(write.bucketsPatch);
    assignments.push(`learn_buckets = json_patch(learn_buckets, ?${values.length})`);
  }
  values.push(write.version);
  const statements = [
    db
      .prepare(
        `UPDATE user_stats SET ${assignments.join(', ')} WHERE user_id = ?1 AND version = ?${values.length}`,
      )
      .bind(...values),
  ];
  if (write.settings !== null) {
    statements.push(settingsStatement(db, write.userId, write.settings));
  }
  const written = await db.batch(statements);
  return (written[0]?.meta.changes ?? 0) > 0;
}

// `GET /api/sync`

/** The path of one device's last `seq` in `device_seq`; the id is a UUID, so it needs no escaping. */
function seqPath(deviceId: string): string {
  return `$.${quoted(deviceId)}.seq`;
}

function lastSeqOf(row: Row): number {
  return numberOf(row, 'last_seq') ?? 0;
}

/** `{ lastSeq, version }`, read by the key of the row. `null` when the user has no row. */
export async function readAck(
  db: D1Database,
  userId: string,
  deviceId: string,
): Promise<{ lastSeq: number; version: number } | null> {
  const row = await db
    .prepare(
      'SELECT json_extract(device_seq, ?2) AS last_seq, version FROM user_stats WHERE user_id = ?1',
    )
    .bind(userId, seqPath(deviceId))
    .first();
  if (!isRow(row)) return null;
  const version = numberOf(row, 'version');
  if (version === null) throw corrupt('user_stats', 'version');
  return { lastSeq: lastSeqOf(row), version };
}

export type SnapshotPart = 'rest' | 'recent' | 'buckets';

export function isSnapshotPart(value: string): value is SnapshotPart {
  return value === 'rest' || value === 'recent' || value === 'buckets';
}

function stored(row: Row, column: string): string {
  const text = textOf(row, column);
  if (text === null) throw corrupt('user_stats', column);
  return text;
}

/**
 * One part of the snapshot as a JSON string, put together from the stored column strings and never
 * parsed (ADR 082). Every part carries the `version` of the same read. `null` when the user has no row.
 */
export async function readPart(
  db: D1Database,
  userId: string,
  deviceId: string,
  part: SnapshotPart,
): Promise<string | null> {
  if (part === 'rest') {
    const row = await db
      .prepare(
        `SELECT counters, learn, version,
           json_extract(device_seq, ?2) AS last_seq,
           (SELECT json FROM user_settings WHERE user_id = ?1) AS settings
         FROM user_stats WHERE user_id = ?1`,
      )
      .bind(userId, seqPath(deviceId))
      .first();
    if (!isRow(row)) return null;
    const version = numberOf(row, 'version');
    if (version === null) throw corrupt('user_stats', 'version');
    return (
      `{"part":"rest","lastSeq":${lastSeqOf(row)},"version":${version},` +
      `"settings":${textOf(row, 'settings') ?? 'null'},"counters":${stored(row, 'counters')},` +
      `"learn":${stored(row, 'learn')}}`
    );
  }
  const column = part === 'recent' ? 'learn_recent' : 'learn_buckets';
  const field = part === 'recent' ? 'recent' : 'recallBuckets';
  const row = await db
    .prepare(`SELECT ${column}, version FROM user_stats WHERE user_id = ?1`)
    .bind(userId)
    .first();
  if (!isRow(row)) return null;
  const version = numberOf(row, 'version');
  if (version === null) throw corrupt('user_stats', 'version');
  return `{"part":"${part}","version":${version},"${field}":${stored(row, column)}}`;
}
