import type {
  Counters,
  DayBuckets,
  LearnBox,
  LearnEntry,
  LearnKanaKey,
  LearnState,
  LearnStat,
  RecallAnswer,
  ValidTestConfig,
  ValidSettings,
  ValidKanaStats,
  ValidProgress,
} from './types';

export function isObject(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

export function isTestConfig(value: unknown): value is ValidTestConfig {
  if (!isObject(value)) return false;

  if (value['kind'] === 'time') {
    const s = value['seconds'];
    return s === 15 || s === 30 || s === 60 || s === 120;
  }

  if (value['kind'] === 'count') {
    const p = value['prompts'];
    return p === 10 || p === 25 || p === 50 || p === 100;
  }

  if (value['kind'] === 'zen') return true;

  return false;
}

function isTypingSettings(value: unknown): value is ValidSettings['typing'] {
  if (!isObject(value)) return false;
  const script = value['script'];
  if (script !== 'hiragana' && script !== 'katakana' && script !== 'both') return false;
  const content = value['content'];
  if (content !== 'words' && content !== 'phrases') return false;
  const strictness = value['strictness'];
  if (strictness !== 'learner' && strictness !== 'ime') return false;
  if (typeof value['weakFocus'] !== 'boolean') return false;
  if (typeof value['showTranslation'] !== 'boolean') return false;
  return isTestConfig(value['test']);
}

function isLearnSettings(value: unknown): value is ValidSettings['learn'] {
  if (!isObject(value)) return false;
  const strictness = value['strictness'];
  if (strictness !== 'learner' && strictness !== 'ime') return false;
  const track = value['track'];
  if (track !== 'hiragana' && track !== 'katakana') return false;
  const ms = value['targetMs'];
  if (typeof ms !== 'number' || !Number.isInteger(ms) || ms < 1000 || ms > 3000) return false;
  if (ms % 250 !== 0) return false;
  return typeof value['sound'] === 'boolean';
}

export function isSettings(value: unknown): value is ValidSettings {
  if (!isObject(value)) return false;
  const updatedAt = value['updatedAt'];
  if (typeof updatedAt !== 'number' || !Number.isFinite(updatedAt)) return false;
  return isTypingSettings(value['typing']) && isLearnSettings(value['learn']);
}

export function isKanaStats(value: unknown): value is ValidKanaStats {
  if (!isObject(value)) return false;
  return (
    typeof value['a'] === 'number' &&
    typeof value['m'] === 'number' &&
    typeof value['t'] === 'number'
  );
}

export function isProgress(value: unknown): value is ValidProgress {
  if (!isObject(value)) return false;
  if (value['v'] !== 1) return false;

  const stats = value['stats'];
  if (!isObject(stats)) return false;

  for (const key of Object.keys(stats)) {
    if (!isKanaStats(stats[key])) {
      return false;
    }
  }

  return true;
}

// Learning state: guards and merge functions. The client builds its local view with them and the
// server applies the same ones (spec storage-sync.md, "Merge rules").

/** How many recall answers of a kana are kept. */
export const RECENT_ANSWERS = 10;

export function isLearnKanaKey(value: unknown): value is LearnKanaKey {
  return (
    typeof value === 'string' &&
    (value.startsWith('hiragana:') || value.startsWith('katakana:')) &&
    value.length > 9
  );
}

function isCount(value: unknown): value is number {
  return typeof value === 'number' && Number.isInteger(value) && value >= 0;
}

export function isRecallAnswer(value: unknown): value is RecallAnswer {
  return (
    isObject(value) &&
    typeof value['at'] === 'number' &&
    Number.isFinite(value['at']) &&
    typeof value['ms'] === 'number' &&
    Number.isFinite(value['ms']) &&
    typeof value['ok'] === 'boolean'
  );
}

function isBox(value: unknown): value is LearnBox {
  return value === 0 || value === 1 || value === 2 || value === 3 || value === 4 || value === 5;
}

export function isLearnEntry(value: unknown): value is LearnEntry {
  return (
    isObject(value) &&
    isBox(value['box']) &&
    typeof value['dueAt'] === 'number' &&
    Number.isFinite(value['dueAt']) &&
    typeof value['updatedAt'] === 'number' &&
    Number.isFinite(value['updatedAt'])
  );
}

export function isLearnStat(value: unknown): value is LearnStat {
  if (!isObject(value)) return false;
  if (!isCount(value['recognitions']) || !isCount(value['recognitionErrors'])) return false;
  const mixups = value['mixups'];
  if (!isObject(mixups)) return false;
  return Object.keys(mixups).every((key) => isLearnKanaKey(key) && isCount(mixups[key]));
}

function isRecordOf(value: unknown, guard: (item: unknown) => boolean): boolean {
  if (!isObject(value)) return false;
  return Object.keys(value).every((key) => isLearnKanaKey(key) && guard(value[key]));
}

function isRecallList(value: unknown): value is readonly RecallAnswer[] {
  return Array.isArray(value) && value.length <= RECENT_ANSWERS && value.every(isRecallAnswer);
}

function isKeyList(value: unknown): value is readonly LearnKanaKey[] {
  return Array.isArray(value) && value.every(isLearnKanaKey);
}

function isDay(value: unknown): value is number {
  return typeof value === 'number' && Number.isInteger(value);
}

export function isActiveDays(value: unknown): value is LearnState['activeDays'] {
  if (!Array.isArray(value)) return false;
  let previousLast = -Infinity;
  for (const run of value) {
    if (!Array.isArray(run) || run.length !== 2) return false;
    const first: unknown = run[0];
    const last: unknown = run[1];
    if (!isDay(first) || !isDay(last) || first > last || first <= previousLast + 1) return false;
    previousLast = last;
  }
  return true;
}

function isDayBuckets(value: unknown): value is DayBuckets {
  if (!isObject(value)) return false;
  return Object.keys(value).every((day) => {
    const buckets = value[day];
    return (
      isDay(Number(day)) &&
      isObject(buckets) &&
      Object.keys(buckets).every((bucket) => {
        const index = Number(bucket);
        return (
          Number.isInteger(index) && index >= 0 && index <= MAX_BUCKET && isCount(buckets[bucket])
        );
      })
    );
  });
}

function isRecallBuckets(value: unknown): value is LearnState['recallBuckets'] {
  return isObject(value) && isDayBuckets(value['hiragana']) && isDayBuckets(value['katakana']);
}

export function isLearnState(value: unknown): value is LearnState {
  if (!isObject(value)) return false;
  const unlocked = value['unlocked'];
  if (!isObject(unlocked)) return false;
  return (
    isKeyList(unlocked['hiragana']) &&
    isKeyList(unlocked['katakana']) &&
    isRecordOf(value['entries'], isLearnEntry) &&
    isRecordOf(value['recent'], isRecallList) &&
    isRecordOf(value['stats'], isLearnStat) &&
    isActiveDays(value['activeDays']) &&
    isRecallBuckets(value['recallBuckets'])
  );
}

const MODES = ['typing', 'learn'] as const;

function isModeCounts(value: unknown): value is Counters['started'] {
  return isObject(value) && MODES.every((mode) => isCount(value[mode]));
}

export function isCounters(value: unknown): value is Counters {
  return isObject(value) && isModeCounts(value['started']) && isModeCounts(value['finished']);
}

/** Union of unlocked kana, listed in `order` (the track order); a kana outside it follows, sorted. */
export function mergeUnlocked(
  order: readonly LearnKanaKey[],
  a: readonly LearnKanaKey[],
  b: readonly LearnKanaKey[],
): LearnKanaKey[] {
  const wanted = new Set([...a, ...b]);
  const merged = order.filter((key) => wanted.has(key));
  const known = new Set(order);
  const extra = [...wanted].filter((key) => !known.has(key)).sort();
  return [...merged, ...extra];
}

/** Union of recall answers identified by `at`; the 10 latest are kept, oldest first. */
export function mergeRecent(
  a: readonly RecallAnswer[],
  b: readonly RecallAnswer[],
): RecallAnswer[] {
  const byAt = new Map<number, RecallAnswer>();
  for (const answer of [...a, ...b]) {
    const known = byAt.get(answer.at);
    // The same answer from both sides is one answer; if the copies differ, the smaller wins, so the
    // result does not depend on the argument order.
    if (known === undefined || answer.ms < known.ms || (answer.ms === known.ms && !answer.ok)) {
      byAt.set(answer.at, answer);
    }
  }
  return [...byAt.values()].sort((x, y) => x.at - y.at).slice(-RECENT_ANSWERS);
}

/** Last-write-wins on `updatedAt`; a tie is decided by the box, then the due date. */
export function mergeEntry(a: LearnEntry, b: LearnEntry): LearnEntry {
  if (a.updatedAt !== b.updatedAt) return a.updatedAt > b.updatedAt ? a : b;
  if (a.box !== b.box) return a.box > b.box ? a : b;
  return a.dueAt >= b.dueAt ? a : b;
}

export function mergeEntries(
  a: Readonly<Record<LearnKanaKey, LearnEntry>>,
  b: Readonly<Record<LearnKanaKey, LearnEntry>>,
): Record<LearnKanaKey, LearnEntry> {
  const merged: Record<string, LearnEntry> = { ...a };
  for (const [key, theirs] of Object.entries(b)) {
    const mine = merged[key];
    merged[key] = mine === undefined ? theirs : mergeEntry(mine, theirs);
  }
  return merged;
}

/** Counters are added. */
export function addCounters(a: Counters, b: Counters): Counters {
  return {
    started: {
      typing: a.started.typing + b.started.typing,
      learn: a.started.learn + b.started.learn,
    },
    finished: {
      typing: a.finished.typing + b.finished.typing,
      learn: a.finished.learn + b.finished.learn,
    },
  };
}

/** A kana's learning counters and mixups are added (decay runs afterwards). */
export function addLearnStats(a: LearnStat, b: LearnStat): LearnStat {
  const mixups: Record<string, number> = { ...a.mixups };
  for (const [key, count] of Object.entries(b.mixups)) {
    mixups[key] = (mixups[key] ?? 0) + count;
  }
  return {
    recognitions: a.recognitions + b.recognitions,
    recognitionErrors: a.recognitionErrors + b.recognitionErrors,
    mixups,
  };
}

/** Union of the runs of active days; overlapping or adjacent runs are joined. */
export function mergeActiveDays(
  a: LearnState['activeDays'],
  b: LearnState['activeDays'],
): [number, number][] {
  const runs = [...a, ...b].map((run): [number, number] => [run[0], run[1]]);
  runs.sort((x, y) => x[0] - y[0] || x[1] - y[1]);
  const merged: [number, number][] = [];
  for (const run of runs) {
    const last = merged[merged.length - 1];
    if (last !== undefined && run[0] <= last[1] + 1) last[1] = Math.max(last[1], run[1]);
    else merged.push(run);
  }
  return merged;
}

/** Width of an answer-time bucket, ms. */
export const BUCKET_MS = 100;
/** The last bucket holds every time from the cap on. */
export const MAX_BUCKET = 100;
/** Days of a track older than this before its newest day are dropped. */
export const BUCKET_DAYS = 365;

/** The bucket of an answer time. */
export function bucketOf(ms: number): number {
  return Math.min(MAX_BUCKET, Math.max(0, Math.floor(ms / BUCKET_MS)));
}

/** Drops the days more than 365 days before the newest day. */
export function dropOldDays(days: DayBuckets): DayBuckets {
  const keys = Object.keys(days);
  if (keys.length === 0) return days;
  const newest = Math.max(...keys.map(Number));
  const kept: Record<string, Readonly<Record<string, number>>> = {};
  for (const key of keys) {
    const buckets = days[key];
    if (buckets !== undefined && Number(key) >= newest - BUCKET_DAYS) kept[key] = buckets;
  }
  return kept;
}

/** Bucket counts are added per day; old days are dropped afterwards. */
export function addBuckets(a: DayBuckets, b: DayBuckets): DayBuckets {
  const sum: Record<string, Record<string, number>> = {};
  for (const source of [a, b]) {
    for (const [day, buckets] of Object.entries(source)) {
      const target = (sum[day] ??= {});
      for (const [bucket, count] of Object.entries(buckets)) {
        target[bucket] = (target[bucket] ?? 0) + count;
      }
    }
  }
  return dropOldDays(sum);
}

/** Decay is applied above this many recognitions. */
export const RECOGNITION_DECAY_AT = 200;

/** Halves a kana's learning counters and mixups when recognitions pass 200; zero entries go. */
export function decayLearnStat(stat: LearnStat): LearnStat {
  if (stat.recognitions <= RECOGNITION_DECAY_AT) return stat;
  const mixups: Record<string, number> = {};
  for (const [key, count] of Object.entries(stat.mixups)) {
    const half = Math.floor(count / 2);
    if (half > 0) mixups[key] = half;
  }
  return {
    recognitions: Math.floor(stat.recognitions / 2),
    recognitionErrors: Math.floor(stat.recognitionErrors / 2),
    mixups,
  };
}
