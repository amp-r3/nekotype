import {
  BUCKET_DAYS,
  addCounters,
  addKanaStats,
  addLearnStats,
  applyResultToRecords,
  decayKanaStat,
  decayLearnStat,
  isCounters,
  isLearnKanaKey,
  isObject,
  isTypingRecords,
  mergeActiveDays,
  mergeEntries,
  mergeUnlocked,
  patchBuckets,
  patchRecent,
  touchedKeys,
} from '@nekotype/shared/runtime';
import type {
  Counters,
  DayBuckets,
  KanaStat,
  LearnEntry,
  LearnKanaKey,
  LearnStat,
  RecallAnswer,
  SyncRequest,
  Track,
  TypingRecords,
} from '@nekotype/shared/types';
import { USER_ID, ackBody, parseObject, recallList } from './apply-batch';
import type { Applied } from './apply-batch';
import type { D1Database, D1PreparedStatement } from './d1';

// The variant `keyed` of the follow-up measurement to ADR 081. It differs from `applyBatch` in
// three ways: the response has no snapshot; the touched keys are read with `json_extract` and one
// bound path per key instead of `json_each`, so a read is one row; and `learn` is not parsed whole:
// its touched entries and statistics are read by path and written with `json_patch`.
//
// It is a cost model, not the endpoint. Two things the endpoint must solve are approximated here:
// the day that falls out of the 365-day window is taken as "a touched day minus 366" (the real
// rule needs the newest stored day of the track, which this variant does not read), and a merge
// patch cannot remove a key inside an entry or a `mixups` object.

const TRACKS: readonly Track[] = ['hiragana', 'katakana'];
/** D1 allows 100 bound parameters per query; one is the user and one the unused first path. */
const MAX_PATHS = 98;
/** `json_extract` with one path returns the bare value; a first path that never exists keeps the result an array. */
const NO_PATH = '$._';

type Row = {
  readonly kana_stats: string;
  readonly counters: string;
  readonly typing_records: string;
  readonly device_seq: string;
  readonly version: number;
  readonly unlocked: string | null;
  readonly active_days: string | null;
  readonly days: string | null;
};
type Extracted = { readonly found: string | null };

function quoted(key: string): string {
  return `"${key}"`;
}

/** `SELECT json_extract(column, ?2, ?3, …) AS found` for the paths, in statements of at most 98 paths. */
function extractStatements(
  db: D1Database,
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
        .bind(USER_ID, ...chunk),
    );
  }
  return statements;
}

/** The values of one or more `found` results, without the unused first path of each. */
function extractedValues(results: readonly (Extracted | undefined)[]): unknown[] {
  const values: unknown[] = [];
  for (const result of results) {
    const parsed: unknown = JSON.parse(result?.found ?? '[]');
    if (!Array.isArray(parsed)) continue;
    const list: readonly unknown[] = parsed;
    values.push(...list.slice(1));
  }
  return values;
}

function isRow(value: unknown): value is Row {
  return isObject(value) && 'version' in value;
}

function isExtracted(value: unknown): value is Extracted {
  return isObject(value) && 'found' in value;
}

function keyList(value: unknown): LearnKanaKey[] {
  return Array.isArray(value) ? value.filter(isLearnKanaKey) : [];
}

export async function applyKeyed(
  db: D1Database,
  request: SyncRequest,
  now: number,
): Promise<Applied> {
  const { delta } = request;
  const touched = touchedKeys(delta.learn);
  const entryKeys = Object.keys(delta.learn.entries);
  const statKeys = Object.keys(delta.learn.stats);

  // Reads: the small columns with the touched days, then the touched kana of each object.
  const dayPaths = [NO_PATH];
  const dayIndex: { track: Track; day: string }[] = [];
  for (const track of TRACKS) {
    for (const day of touched.days[track]) {
      dayPaths.push(`$.${track}.${quoted(day)}`);
      dayIndex.push({ track, day });
    }
  }
  const dayMarks = dayPaths.map((_, index) => `?${index + 2}`).join(', ');
  const recentReads = extractStatements(
    db,
    'learn_recent',
    touched.kana.map((key) => `$.${quoted(key)}`),
  );
  const entryReads = extractStatements(
    db,
    'learn',
    entryKeys.map((key) => `$.entries.${quoted(key)}`),
  );
  const statReads = extractStatements(
    db,
    'learn',
    statKeys.map((key) => `$.stats.${quoted(key)}`),
  );
  const read = await db.batch<unknown>([
    db
      .prepare(
        `SELECT kana_stats, counters, typing_records, device_seq, version, json_extract(learn, '$.unlocked') AS unlocked, json_extract(learn, '$.activeDays') AS active_days, json_extract(learn_buckets, ${dayMarks}) AS days FROM user_stats WHERE user_id = ?1`,
      )
      .bind(USER_ID, ...dayPaths),
    ...recentReads,
    ...entryReads,
    ...statReads,
  ]);
  const row = read[0]?.results[0];
  if (!isRow(row)) return { body: '{"error":{"code":"unavailable"}}', metas: [], status: 503 };
  const readMetas = read.map((result) => result.meta);
  const found = read.slice(1).map((result) => {
    const first = result.results[0];
    return isExtracted(first) ? first : undefined;
  });
  const recentValues = extractedValues(found.slice(0, recentReads.length));
  const entryValues = extractedValues(
    found.slice(recentReads.length, recentReads.length + entryReads.length),
  );
  const statValues = extractedValues(found.slice(recentReads.length + entryReads.length));

  // The `seq` rules.
  const deviceSeq = parseObject(row.device_seq);
  const known = deviceSeq[request.deviceId];
  const lastSeq = isObject(known) ? Number(known['seq']) : 0;
  if (request.seq > lastSeq + 1) {
    return {
      body: `{"error":{"code":"seq_gap","lastSeq":${lastSeq}}}`,
      metas: readMetas,
      status: 409,
    };
  }

  // The typing columns are small and stay whole.
  const kanaStats: Record<string, KanaStat> = {};
  for (const [key, stat] of Object.entries(parseObject(row.kana_stats))) {
    if (isObject(stat))
      kanaStats[key] = {
        attempts: Number(stat['attempts']),
        erroredAttempts: Number(stat['erroredAttempts']),
      };
  }
  for (const [key, stat] of Object.entries(delta.kanaStats)) {
    kanaStats[key] = decayKanaStat(addKanaStats(kanaStats[key], stat));
  }
  const storedCounters: unknown = JSON.parse(row.counters);
  const counters: Counters = isCounters(storedCounters)
    ? addCounters(storedCounters, delta.counters)
    : delta.counters;
  const storedRecords: unknown = JSON.parse(row.typing_records);
  let records: TypingRecords = isTypingRecords(storedRecords) ? storedRecords : {};
  const results = [...request.results].sort(
    (a, b) => a.endedAt - b.endedAt || (a.id < b.id ? -1 : a.id > b.id ? 1 : 0),
  );
  for (const result of results) records = applyResultToRecords(records, result).records;

  // `learn`: a patch of the touched keys.
  const storedEntries: Record<string, LearnEntry> = {};
  entryKeys.forEach((key, index) => {
    const value = entryValues[index];
    // The stored column was written by this function (or the seed), so its shape is known.
    if (isObject(value)) Object.assign(storedEntries, { [key]: value });
  });
  const mergedEntries = mergeEntries(storedEntries, delta.learn.entries);
  const storedStats: Record<string, LearnStat> = {};
  statKeys.forEach((key, index) => {
    const value = statValues[index];
    if (isObject(value)) Object.assign(storedStats, { [key]: value });
  });
  const mergedStats: Record<string, LearnStat> = {};
  for (const [key, stat] of Object.entries(delta.learn.stats)) {
    const mine = storedStats[key];
    mergedStats[key] = decayLearnStat(mine === undefined ? stat : addLearnStats(mine, stat));
  }
  const unlocked = parseObject(row.unlocked);
  const activeDays: [number, number][] = [];
  const storedDays: unknown = JSON.parse(row.active_days ?? '[]');
  if (Array.isArray(storedDays)) {
    for (const run of storedDays) {
      if (Array.isArray(run)) activeDays.push([Number(run[0]), Number(run[1])]);
    }
  }
  const learnPatch = {
    unlocked: {
      hiragana: mergeUnlocked([], keyList(unlocked['hiragana']), delta.learn.unlocked.hiragana),
      katakana: mergeUnlocked([], keyList(unlocked['katakana']), delta.learn.unlocked.katakana),
    },
    entries: mergedEntries,
    stats: mergedStats,
    activeDays: mergeActiveDays(activeDays, delta.learn.activeDays),
  };

  // The two large columns.
  const storedRecent: Record<LearnKanaKey, readonly RecallAnswer[]> = {};
  touched.kana.forEach((key, index) => {
    storedRecent[key] = recallList(recentValues[index]);
  });
  const recentPatch = patchRecent(storedRecent, delta.learn.recent);
  const dayValues: unknown = JSON.parse(row.days ?? '[]');
  const storedBuckets: Record<Track, Record<string, Record<string, number>>> = {
    hiragana: {},
    katakana: {},
  };
  dayIndex.forEach(({ track, day }, index) => {
    const value: unknown = Array.isArray(dayValues) ? dayValues[index + 1] : undefined;
    if (!isObject(value)) return;
    const buckets: Record<string, number> = {};
    for (const [bucket, count] of Object.entries(value)) buckets[bucket] = Number(count);
    storedBuckets[track][day] = buckets;
  });
  const bucketsPatch: Record<string, unknown> = {};
  for (const track of TRACKS) {
    if (touched.days[track].length === 0) continue;
    const stored: DayBuckets = storedBuckets[track];
    const patch = patchBuckets(stored, [], delta.learn.recallBuckets[track]);
    for (const day of touched.days[track]) {
      const expired = String(Number(day) - BUCKET_DAYS - 1);
      if (!(expired in patch)) patch[expired] = null;
    }
    bucketsPatch[track] = patch;
  }

  const deviceSeqNext = {
    ...deviceSeq,
    [request.deviceId]: { seq: Math.max(lastSeq, request.seq), at: now },
  };
  const writes = [
    db
      .prepare(
        'UPDATE user_stats SET kana_stats = ?1, counters = ?2, learn = json_patch(learn, ?3), typing_records = ?4, device_seq = ?5, last_sync_at = ?6, learn_recent = json_patch(learn_recent, ?7), learn_buckets = json_patch(learn_buckets, ?8), version = version + 1 WHERE user_id = ?9 AND version = ?10 RETURNING version',
      )
      .bind(
        JSON.stringify(kanaStats),
        JSON.stringify(counters),
        JSON.stringify(learnPatch),
        JSON.stringify(records),
        JSON.stringify(deviceSeqNext),
        now,
        JSON.stringify(recentPatch),
        JSON.stringify(bucketsPatch),
        USER_ID,
        row.version,
      ),
  ];
  if (results.length > 0) {
    writes.push(
      db
        .prepare(
          "INSERT OR IGNORE INTO results (id, user_id, ended_at, content, script, strictness, config, kpm, kana_accuracy, json) SELECT json_extract(value, '$.id'), ?1, json_extract(value, '$.endedAt'), json_extract(value, '$.content'), json_extract(value, '$.script'), json_extract(value, '$.strictness'), CASE json_extract(value, '$.config.kind') WHEN 'time' THEN 'time:' || json_extract(value, '$.config.seconds') WHEN 'count' THEN 'count:' || json_extract(value, '$.config.prompts') ELSE 'zen' END, json_extract(value, '$.kpm'), json_extract(value, '$.kanaAccuracy'), value FROM json_each(?2)",
        )
        .bind(USER_ID, JSON.stringify(results)),
    );
  }
  const written = await db.batch<unknown>(writes);
  const metas = [...readMetas, ...written.map((result) => result.meta)];
  if (written[0] === undefined || written[0].meta.changes === 0) {
    return { body: '{"error":{"code":"conflict"}}', metas, status: 503 };
  }
  return { body: ackBody(Math.max(lastSeq, request.seq), row.version + 1), metas, status: 200 };
}

const PARTS = {
  recent: 'learn_recent',
  buckets: 'learn_buckets',
  rest: "json_object('kanaStats', json(kana_stats), 'counters', json(counters), 'learn', json(learn), 'typingRecords', json(typing_records))",
} as const;

export type Part = keyof typeof PARTS;

export function isPart(value: string): value is Part {
  return value in PARTS;
}

/** One part of the snapshot: the candidate `GET` that never carries the whole row. */
export async function readPart(db: D1Database, part: Part): Promise<Applied> {
  const [result] = await db.batch<unknown>([
    db.prepare(`SELECT ${PARTS[part]} AS found FROM user_stats WHERE user_id = ?1`).bind(USER_ID),
  ]);
  const first = result?.results[0];
  if (result === undefined || !isExtracted(first) || first.found === null) {
    return { body: '{"error":{"code":"unavailable"}}', metas: [], status: 503 };
  }
  return { body: first.found, metas: [result.meta], status: 200 };
}

/** The least a request with a session costs: one row read by its key. */
export async function readVersion(db: D1Database): Promise<Applied> {
  const [result] = await db.batch<unknown>([
    db.prepare('SELECT version FROM user_stats WHERE user_id = ?1').bind(USER_ID),
  ]);
  const first = result?.results[0];
  if (result === undefined || !isRow(first)) {
    return { body: '{"error":{"code":"unavailable"}}', metas: [], status: 503 };
  }
  return { body: `{"version":${first.version}}`, metas: [result.meta], status: 200 };
}
