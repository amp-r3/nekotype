import {
  addCounters,
  applyResultsToRecords,
  isActiveDays,
  isCounters,
  isKanaStats,
  isLearnEntry,
  isLearnKanaKey,
  isLearnStat,
  isObject,
  isRecallAnswer,
  isTypingRecords,
  mergeKanaStats,
  patchBuckets,
  patchLearn,
  patchRecent,
  touchedKeys,
} from '@nekotype/shared/runtime';
import type {
  DayBuckets,
  LearnEntry,
  LearnKanaKey,
  LearnStat,
  RecallAnswer,
  SyncRequest,
  SyncResponse,
  Track,
} from '@nekotype/shared/types';
import { readForSync, writeSync } from '../db/sync';
import type { ReadPlan, StoredRow, SyncWrite } from '../db/sync';
import { corrupt } from '../db/rows';

// The server side of "Applying a batch" (docs/spec/backend.md; ADR 082): reads the keys the batch
// touches, merges them by the rules of storage-sync.md with the functions of `shared/runtime`, and
// writes the result as JSON Merge Patches. `shared/runtime`'s `applyBatch` is the same rule on a
// whole snapshot, which the client uses; a property test keeps the two equal.

const TRACKS: readonly Track[] = ['hiragana', 'katakana'];
const DAY_MS = 24 * 60 * 60 * 1000;
/** `device_seq` entries not updated for 90 days are removed on the next write (storage-sync.md, Batches). */
const DEVICE_SEQ_TTL_MS = 90 * DAY_MS;

export type SyncOutcome =
  | { readonly kind: 'ok'; readonly response: SyncResponse }
  /** `seq` > last + 1. */
  | { readonly kind: 'gap'; readonly lastSeq: number }
  /** The interval since the last applied sync has not elapsed. */
  | { readonly kind: 'limited'; readonly retryAfterSeconds: number }
  /** Another request won the version twice. */
  | { readonly kind: 'conflict' };

export interface SyncOptions {
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

function isNewest(value: unknown): value is Partial<Record<Track, number>> {
  return (
    isObject(value) &&
    Object.entries(value).every(
      ([track, day]) => (track === 'hiragana' || track === 'katakana') && typeof day === 'number',
    )
  );
}

function keysOf(value: unknown): LearnKanaKey[] {
  if (!Array.isArray(value)) return [];
  const keys: LearnKanaKey[] = [];
  for (const item of value) if (isLearnKanaKey(item)) keys.push(item);
  return keys;
}

function recallList(value: unknown): RecallAnswer[] {
  if (value === null || value === undefined) return [];
  if (!Array.isArray(value)) throw corrupt('learn_recent', 'kana');
  const list: RecallAnswer[] = [];
  for (const item of value) {
    if (!isRecallAnswer(item)) throw corrupt('learn_recent', 'answer');
    list.push(item);
  }
  return list;
}

function bucketsOf(value: unknown): Record<string, number> | undefined {
  if (value === null || value === undefined) return undefined;
  if (!isObject(value)) throw corrupt('learn_buckets', 'day');
  const buckets: Record<string, number> = {};
  for (const [bucket, count] of Object.entries(value)) {
    if (typeof count !== 'number') throw corrupt('learn_buckets', 'bucket');
    buckets[bucket] = count;
  }
  return buckets;
}

/** The stored values of the planned keys, as the maps the merge functions take. */
function byKey<T>(
  keys: readonly string[],
  values: readonly unknown[],
  guard: (value: unknown) => value is T,
  column: string,
): Record<string, T> {
  const map: Record<string, T> = {};
  keys.forEach((key, index) => {
    const value = values[index];
    if (value === null || value === undefined) return;
    if (!guard(value)) throw corrupt('learn', column);
    map[key] = value;
  });
  return map;
}

/** Steps 1–3 for one attempt: the write that the stored row and the batch give, or the early answer. */
function planWrite(
  userId: string,
  request: SyncRequest,
  row: StoredRow,
  options: SyncOptions,
): { early: SyncOutcome } | { write: SyncWrite; lastSeq: number } {
  const { delta } = request;
  const learn = delta.learn;

  if (!isDeviceSeq(row.deviceSeq)) throw corrupt('user_stats', 'device_seq');
  const deviceSeq = row.deviceSeq;
  const lastSeq = deviceSeq[request.deviceId]?.seq ?? 0;
  // `seq` ≤ last: the batch is already applied. Answered like an applied one, and not limited,
  // because it writes nothing.
  if (request.seq <= lastSeq) {
    return { early: { kind: 'ok', response: { lastSeq, version: row.version } } };
  }
  if (request.seq > lastSeq + 1) return { early: { kind: 'gap', lastSeq } };
  const wait = row.lastSyncAt + options.minIntervalMs - options.now;
  if (wait > 0) return { early: { kind: 'limited', retryAfterSeconds: Math.ceil(wait / 1000) } };

  // The small columns, whole.
  if (!isKanaStats(row.kanaStats)) throw corrupt('user_stats', 'kana_stats');
  if (!isCounters(row.counters)) throw corrupt('user_stats', 'counters');
  if (!isTypingRecords(row.typingRecords)) throw corrupt('user_stats', 'typing_records');
  if (!isNewest(row.bucketNewest)) throw corrupt('user_stats', 'bucket_newest');
  const kanaStats = mergeKanaStats(row.kanaStats, delta.kanaStats);
  const counters = addCounters(row.counters, delta.counters);
  const typingRecords = applyResultsToRecords(row.typingRecords, request.results);

  // `learn`: the small fields whole, the touched entries and statistics by path.
  const unlocked = isObject(row.unlocked) ? row.unlocked : {};
  if (!isActiveDays(row.activeDays)) throw corrupt('learn', 'activeDays');
  const keys = readPlan(request);
  const learnPatch = patchLearn(
    {
      unlocked: {
        hiragana: keysOf(unlocked['hiragana']),
        katakana: keysOf(unlocked['katakana']),
      },
      activeDays: row.activeDays,
      entries: byKey<LearnEntry>(keys.entries, row.entries, isLearnEntry, 'entries'),
      stats: byKey<LearnStat>(keys.stats, row.stats, isLearnStat, 'stats'),
    },
    learn,
  );

  // The two large columns.
  const touched = touchedKeys(learn);
  const storedRecent: Record<LearnKanaKey, readonly RecallAnswer[]> = {};
  touched.kana.forEach((key, index) => {
    storedRecent[key] = recallList(row.recent[index]);
  });
  const recentPatch = patchRecent(storedRecent, learn.recent);

  const storedDays: Record<Track, Record<string, Readonly<Record<string, number>>>> = {
    hiragana: {},
    katakana: {},
  };
  let offset = 0;
  for (const track of TRACKS) {
    for (const day of keys.days[track]) {
      const buckets = bucketsOf(row.days[offset]);
      if (buckets !== undefined) storedDays[track][day] = buckets;
      offset += 1;
    }
  }
  const bucketsPatch: Record<string, unknown> = {};
  const bucketNewest: Partial<Record<Track, number>> = { ...row.bucketNewest };
  for (const track of TRACKS) {
    if (keys.days[track].length === 0) continue;
    const stored: DayBuckets = storedDays[track];
    const { patch, newest } = patchBuckets(
      stored,
      row.bucketNewest[track] ?? null,
      learn.recallBuckets[track],
    );
    if (Object.keys(patch).length > 0) bucketsPatch[track] = patch;
    if (newest !== null) bucketNewest[track] = newest;
  }

  // `device_seq`: this device, and the others that are not stale.
  const nextDeviceSeq: DeviceSeq = {};
  for (const [id, entry] of Object.entries(deviceSeq)) {
    if (options.now - entry.at <= DEVICE_SEQ_TTL_MS) nextDeviceSeq[id] = entry;
  }
  nextDeviceSeq[request.deviceId] = { seq: request.seq, at: options.now };

  const write: SyncWrite = {
    userId,
    version: row.version,
    now: options.now,
    kanaStats: JSON.stringify(kanaStats),
    counters: JSON.stringify(counters),
    typingRecords: JSON.stringify(typingRecords),
    deviceSeq: JSON.stringify(nextDeviceSeq),
    bucketNewest: JSON.stringify(bucketNewest),
    learnPatch: JSON.stringify(learnPatch),
    recentPatch: touched.kana.length > 0 ? JSON.stringify(recentPatch) : null,
    bucketsPatch: Object.keys(bucketsPatch).length > 0 ? JSON.stringify(bucketsPatch) : null,
    results: request.results.length > 0 ? JSON.stringify(sortedResults(request)) : null,
    settings:
      delta.settings === null
        ? null
        : {
            json: JSON.stringify(delta.settings),
            updatedAt: delta.settings.updatedAt,
            keepStored: request.seq === 1,
          },
  };
  return { write, lastSeq: request.seq };
}

function sortedResults(request: SyncRequest) {
  return [...request.results].sort(
    (a, b) => a.endedAt - b.endedAt || (a.id < b.id ? -1 : a.id > b.id ? 1 : 0),
  );
}

/** The keys a batch needs from the stored row. */
export function readPlan(request: SyncRequest): ReadPlan {
  const { learn } = request.delta;
  const touched = touchedKeys(learn);
  return {
    entries: Object.keys(learn.entries),
    stats: Object.keys(learn.stats),
    recent: touched.kana,
    days: touched.days,
  };
}

/**
 * Applies one batch (steps 1–4). A write that loses the `version` race is repeated once from the
 * read; losing twice is a `conflict`. The caller has validated the request and checked the session.
 */
export async function applySync(
  db: D1Database,
  userId: string,
  request: SyncRequest,
  options: SyncOptions,
): Promise<SyncOutcome> {
  for (let attempt = 0; attempt < 2; attempt += 1) {
    const row = await readForSync(db, userId, readPlan(request));
    if (row === null) throw corrupt('user_stats', 'user_id');
    const planned = planWrite(userId, request, row, options);
    if ('early' in planned) return planned.early;
    const applied = await writeSync(db, planned.write);
    if (applied) {
      return { kind: 'ok', response: { lastSeq: planned.lastSeq, version: row.version + 1 } };
    }
  }
  return { kind: 'conflict' };
}
