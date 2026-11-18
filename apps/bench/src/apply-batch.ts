import {
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
import type { D1Database, D1Meta, D1Result } from './d1';

// The server side of "Applying a batch" (spec backend.md, decisions D7 of p5-plan.md), without the
// session, the schema validation, the rate limit and the version retry: those are PR 5's, and the
// measurement adds them to the budget (8 of the 10 ms are the pass line).

export const USER_ID = 'bench-user';
const TRACKS: readonly Track[] = ['hiragana', 'katakana'];

type Row = {
  readonly kana_stats: string;
  readonly counters: string;
  readonly learn: string;
  readonly typing_records: string;
  readonly device_seq: string;
  readonly last_sync_at: number;
  readonly version: number;
};
type KeyValue = { readonly key: string; readonly value: string | null };
type Returned = {
  readonly kana_stats: string;
  readonly counters: string;
  readonly learn: string;
  readonly learn_recent: string;
  readonly learn_buckets: string;
  readonly typing_records: string;
};
type Stored = {
  readonly unlocked: Readonly<Record<Track, readonly LearnKanaKey[]>>;
  readonly entries: Readonly<Record<LearnKanaKey, LearnEntry>>;
  readonly stats: Readonly<Record<LearnKanaKey, LearnStat>>;
  readonly activeDays: readonly (readonly [number, number])[];
};

export type Applied = {
  /** The response body, assembled by concatenation. */
  readonly body: string;
  /** `meta` of every statement, in order. */
  readonly metas: readonly D1Meta[];
  readonly status: 200 | 409 | 503;
};

export function parseObject(text: string | null | undefined): Record<string, unknown> {
  const value: unknown = JSON.parse(text ?? '{}');
  return isObject(value) ? value : {};
}

export function recallList(value: unknown): readonly RecallAnswer[] {
  return Array.isArray(value) ? value.filter(isObject).map(toAnswer) : [];
}

function toAnswer(value: Record<string, unknown>): RecallAnswer {
  return { at: Number(value['at']), ms: Number(value['ms']), ok: value['ok'] === true };
}

function dayBuckets(rows: readonly KeyValue[]): { stored: DayBuckets; keys: string[] } {
  const stored: Record<string, Record<string, number>> = {};
  const keys: string[] = [];
  for (const row of rows) {
    keys.push(row.key);
    if (row.value === null) continue;
    const buckets: Record<string, number> = {};
    for (const [bucket, count] of Object.entries(parseObject(row.value))) {
      buckets[bucket] = Number(count);
    }
    stored[row.key] = buckets;
  }
  return { stored, keys };
}

function readLearn(text: string): Stored {
  const raw = parseObject(text);
  const unlocked = isObject(raw['unlocked']) ? raw['unlocked'] : {};
  const list = (track: Track): LearnKanaKey[] => {
    const keys: unknown = unlocked[track];
    return Array.isArray(keys) ? keys.filter(isLearnKanaKey) : [];
  };
  const entries: Record<string, LearnEntry> = {};
  const stats: Record<string, LearnStat> = {};
  // The stored column was written by this function (or the seed), so its shape is known; the
  // guards of PR 5's validation are not part of this measurement.
  Object.assign(entries, raw['entries']);
  Object.assign(stats, raw['stats']);
  const activeDays: [number, number][] = [];
  const days: unknown = raw['activeDays'];
  if (Array.isArray(days)) {
    for (const run of days) {
      if (Array.isArray(run)) activeDays.push([Number(run[0]), Number(run[1])]);
    }
  }
  return {
    unlocked: { hiragana: list('hiragana'), katakana: list('katakana') },
    entries,
    stats,
    activeDays,
  };
}

function snapshotBody(lastSeq: number, row: Returned): string {
  // `learn` without its closing brace, then the two large columns, as the spec describes.
  const learn = `${row.learn.slice(0, -1)},"recent":${row.learn_recent},"recallBuckets":${row.learn_buckets}}`;
  return (
    `{"lastSeq":${lastSeq},"snapshot":{"settings":null,"kanaStats":${row.kana_stats},` +
    `"counters":${row.counters},"learn":${learn},"typingRecords":${row.typing_records}}}`
  );
}

export function ackBody(lastSeq: number, version: number): string {
  return `{"lastSeq":${lastSeq},"version":${version}}`;
}

/** `GET /api/sync`: one `SELECT` of the whole row and one of the settings. */
export async function readSnapshot(db: D1Database, deviceId: string): Promise<Applied> {
  const [rowResult, settings] = await db.batch<Returned & { device_seq: string }>([
    db
      .prepare(
        'SELECT kana_stats, counters, learn, learn_recent, learn_buckets, typing_records, device_seq FROM user_stats WHERE user_id = ?1',
      )
      .bind(USER_ID),
    db.prepare('SELECT json FROM user_settings WHERE user_id = ?1').bind(USER_ID),
  ]);
  const row = rowResult?.results[0];
  if (row === undefined || rowResult === undefined || settings === undefined) {
    return { body: '{"error":{"code":"unavailable"}}', metas: [], status: 503 };
  }
  const seq = parseObject(row.device_seq)[deviceId];
  const lastSeq = isObject(seq) ? Number(seq['seq']) : 0;
  return { body: snapshotBody(lastSeq, row), metas: [rowResult.meta, settings.meta], status: 200 };
}

export async function applyBatch(
  db: D1Database,
  request: SyncRequest,
  now: number,
  /** `false`: the variant `ack`, whose response is `lastSeq` and `version` without the snapshot. */
  snapshot = true,
): Promise<Applied> {
  const { delta } = request;
  const touched = touchedKeys(delta.learn);

  // Reads: one batch of at most four statements.
  const reads = [
    db
      .prepare(
        'SELECT kana_stats, counters, learn, typing_records, device_seq, last_sync_at, version FROM user_stats WHERE user_id = ?1',
      )
      .bind(USER_ID),
    db
      .prepare(
        'SELECT j.key AS key, j.value AS value FROM user_stats s, json_each(s.learn_recent) j WHERE s.user_id = ?1 AND j.key IN (SELECT value FROM json_each(?2))',
      )
      .bind(USER_ID, JSON.stringify(touched.kana)),
  ];
  const readTracks: Track[] = [];
  for (const track of TRACKS) {
    if (touched.days[track].length === 0) continue;
    readTracks.push(track);
    reads.push(
      db
        .prepare(
          'SELECT j.key AS key, CASE WHEN j.key IN (SELECT value FROM json_each(?2)) THEN j.value END AS value FROM user_stats s, json_each(s.learn_buckets, ?3) j WHERE s.user_id = ?1',
        )
        .bind(USER_ID, JSON.stringify(touched.days[track]), `$.${track}`),
    );
  }
  const [rowResult, recentResult, ...bucketResults] = await db.batch<Row | KeyValue>(reads);
  const row = rowResult?.results[0];
  if (
    rowResult === undefined ||
    recentResult === undefined ||
    row === undefined ||
    !('version' in row)
  ) {
    return { body: '{"error":{"code":"unavailable"}}', metas: [], status: 503 };
  }
  const readMetas = [rowResult.meta, recentResult.meta, ...bucketResults.map((r) => r.meta)];

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

  // Merge the small columns whole.
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

  const learn = readLearn(row.learn);
  const stats: Record<string, LearnStat> = { ...learn.stats };
  for (const [key, stat] of Object.entries(delta.learn.stats)) {
    const mine = stats[key];
    stats[key] = decayLearnStat(mine === undefined ? stat : addLearnStats(mine, stat));
  }
  const mergedLearn = {
    unlocked: {
      hiragana: mergeUnlocked([], learn.unlocked.hiragana, delta.learn.unlocked.hiragana),
      katakana: mergeUnlocked([], learn.unlocked.katakana, delta.learn.unlocked.katakana),
    },
    entries: mergeEntries(learn.entries, delta.learn.entries),
    stats,
    activeDays: mergeActiveDays(learn.activeDays, delta.learn.activeDays),
  };

  // The two large columns: patches of the touched keys only.
  const storedRecent: Record<LearnKanaKey, readonly RecallAnswer[]> = {};
  for (const item of recentResult.results) {
    if ('key' in item && isLearnKanaKey(item.key))
      storedRecent[item.key] = recallList(JSON.parse(item.value ?? '[]'));
  }
  const recentPatch = patchRecent(storedRecent, delta.learn.recent);
  const bucketsPatch: Record<string, unknown> = {};
  readTracks.forEach((track, index) => {
    const read = dayBuckets(
      (bucketResults[index]?.results ?? []).filter((item): item is KeyValue => 'key' in item),
    );
    bucketsPatch[track] = patchBuckets(read.stored, read.keys, delta.learn.recallBuckets[track]);
  });

  const deviceSeqNext = {
    ...deviceSeq,
    [request.deviceId]: { seq: Math.max(lastSeq, request.seq), at: now },
  };
  const writes = [
    db
      .prepare(
        `UPDATE user_stats SET kana_stats = ?1, counters = ?2, learn = ?3, typing_records = ?4, device_seq = ?5, last_sync_at = ?6, learn_recent = json_patch(learn_recent, ?7), learn_buckets = json_patch(learn_buckets, ?8), version = version + 1 WHERE user_id = ?9 AND version = ?10 RETURNING ${
          snapshot
            ? 'kana_stats, counters, learn, learn_recent, learn_buckets, typing_records'
            : 'version'
        }`,
      )
      .bind(
        JSON.stringify(kanaStats),
        JSON.stringify(counters),
        JSON.stringify(mergedLearn),
        JSON.stringify(records),
        JSON.stringify(deviceSeqNext),
        now,
        JSON.stringify(recentPatch),
        JSON.stringify(bucketsPatch),
        USER_ID,
        row.version,
      ),
    db.prepare('SELECT json FROM user_settings WHERE user_id = ?1').bind(USER_ID),
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
  const written: readonly D1Result<Returned>[] = await db.batch<Returned>(writes);
  const update = written[0];
  const updated = update?.results[0];
  const writeMetas = written.map((r) => r.meta);
  if (update === undefined || update.meta.changes === 0 || updated === undefined) {
    return {
      body: '{"error":{"code":"conflict"}}',
      metas: [...readMetas, ...writeMetas],
      status: 503,
    };
  }
  return {
    body: snapshot
      ? snapshotBody(Math.max(lastSeq, request.seq), updated)
      : ackBody(Math.max(lastSeq, request.seq), row.version + 1),
    metas: [...readMetas, ...writeMetas],
    status: 200,
  };
}
