import * as v from 'valibot';
import { BATCH_CAPS, MAX_RESULTS_PER_BATCH } from './sync-runtime';
import { RECENT_ANSWERS, isActiveDays, isLearnKanaKey } from './learn-runtime';
import type {
  Counters,
  KanaStat,
  LearnDelta,
  LearnEntry,
  LearnKanaKey,
  LearnStat,
  RecallAnswer,
  ReportRequest,
  SyncDelta,
  SyncRequest,
  TestResult,
  ValidSettings,
} from './types';

// The valibot schemas of the API (p5-plan.md, D10). Server only: the client imports `shared/types`
// and `shared/runtime`, so valibot never reaches its bundle (lint rule in apps/web). Each schema is
// declared against its type, so the two cannot drift apart at compile time. Objects are strict: an
// unknown key is a `400`, never dropped in silence (A28).

const KANA_KEY_MAX = 24;
/** Both tracks together hold 229 kana (ADR 078). */
const KANA_TOTAL = 229;
const MAX_ACTIVE_RUNS = 400;
const MAX_BUCKET_INDEX = 100;
const SHORT_TEXT = 64;
export const REPORT_COMMENT_MAX = 500;

/** A kana key the server may put into a JSON path: no quote or backslash (ADR 082, reads by path). */
function isKanaKey(key: unknown): boolean {
  return isLearnKanaKey(key) && !/["\\]/.test(key);
}

const finite = v.pipe(v.number(), v.finite());
const count = v.pipe(v.number(), v.integer(), v.minValue(0));

export const deviceIdSchema = v.pipe(v.string(), v.uuid());

const kanaKey = v.pipe(
  v.string(),
  v.maxLength(KANA_KEY_MAX),
  v.check((key) => isKanaKey(key), 'not a kana key'),
);

/** A record of kana, at most `max` of them. */
function kanaRecord<T extends v.GenericSchema>(value: T, max: number) {
  return v.pipe(
    v.record(kanaKey, value),
    v.check((record) => Object.keys(record).length <= max, 'too many kana'),
  );
}

// Settings

const testConfigSchema = v.variant('kind', [
  v.strictObject({
    kind: v.literal('time'),
    seconds: v.picklist([15, 30, 60, 120]),
  }),
  v.strictObject({
    kind: v.literal('count'),
    prompts: v.picklist([10, 25, 50, 100]),
  }),
  v.strictObject({ kind: v.literal('zen') }),
]);

const strictness = v.picklist(['learner', 'ime']);

export const settingsSchema = v.strictObject({
  typing: v.strictObject({
    script: v.picklist(['hiragana', 'katakana', 'both']),
    content: v.picklist(['words', 'phrases']),
    strictness,
    weakFocus: v.boolean(),
    test: testConfigSchema,
    showTranslation: v.boolean(),
  }),
  learn: v.strictObject({
    strictness,
    track: v.picklist(['hiragana', 'katakana']),
    // 1000–3000 in steps of 250.
    targetMs: v.pipe(
      v.number(),
      v.integer(),
      v.minValue(1000),
      v.maxValue(3000),
      v.multipleOf(250),
    ),
    sound: v.boolean(),
  }),
  updatedAt: finite,
}) satisfies v.GenericSchema<unknown, ValidSettings>;

// Results

export const testResultSchema = v.pipe(
  v.strictObject({
    id: v.pipe(v.string(), v.uuid()),
    content: v.picklist(['words', 'phrases']),
    script: v.picklist(['hiragana', 'katakana', 'both']),
    strictness,
    config: v.variant('kind', [
      v.strictObject({
        kind: v.literal('time'),
        seconds: v.pipe(count, v.minValue(1)),
      }),
      v.strictObject({
        kind: v.literal('count'),
        prompts: v.pipe(count, v.minValue(1)),
      }),
      v.strictObject({ kind: v.literal('zen') }),
    ]),
    endReason: v.picklist(['complete', 'manual', 'idle', 'hidden']),
    repeated: v.boolean(),
    startedAt: finite,
    endedAt: finite,
    durationMs: count,
    tokens: count,
    erroredTokens: count,
    items: count,
    keystrokes: count,
    rejectedKeystrokes: count,
    assisted: count,
    kpm: v.pipe(finite, v.minValue(0)),
    kanaAccuracy: v.pipe(finite, v.minValue(0), v.maxValue(1)),
    celebratedPersonalBest: v.boolean(),
    contentVersion: v.pipe(v.string(), v.maxLength(SHORT_TEXT)),
    appVersion: v.pipe(v.string(), v.maxLength(SHORT_TEXT)),
  }),
  v.check((result) => result.erroredTokens <= result.tokens, 'more errors than tokens'),
) satisfies v.GenericSchema<unknown, TestResult>;

// The learning part of a batch

const recallAnswerSchema = v.strictObject({
  at: finite,
  ms: finite,
  ok: v.boolean(),
}) satisfies v.GenericSchema<unknown, RecallAnswer>;

const learnEntrySchema = v.strictObject({
  box: v.picklist([0, 1, 2, 3, 4, 5]),
  dueAt: finite,
  updatedAt: finite,
}) satisfies v.GenericSchema<unknown, LearnEntry>;

const learnStatSchema = v.strictObject({
  recognitions: count,
  recognitionErrors: count,
  mixups: kanaRecord(count, KANA_TOTAL),
}) satisfies v.GenericSchema<unknown, LearnStat>;

const kanaListItem = v.custom<LearnKanaKey>(
  (key) => typeof key === 'string' && key.length <= KANA_KEY_MAX && isKanaKey(key),
  'not a kana key',
);
const kanaList = v.pipe(v.array(kanaListItem), v.maxLength(KANA_TOTAL));

const dayKey = v.pipe(v.string(), v.regex(/^\d{1,7}$/));
const bucketKey = v.pipe(
  v.string(),
  v.regex(/^\d{1,3}$/),
  v.check((key) => Number(key) <= MAX_BUCKET_INDEX, 'bucket out of range'),
);

/** Local day → bucket → count, at most `BATCH_CAPS.days` days. */
const dayBuckets = v.pipe(
  v.record(dayKey, v.record(bucketKey, count)),
  v.check((days) => Object.keys(days).length <= BATCH_CAPS.days, 'too many days'),
);

const activeDays = v.pipe(
  v.array(v.tuple([v.pipe(v.number(), v.integer()), v.pipe(v.number(), v.integer())])),
  v.maxLength(MAX_ACTIVE_RUNS),
  v.check((runs) => isActiveDays(runs), 'runs must be ascending, apart and ordered'),
);

export const learnDeltaSchema = v.pipe(
  v.strictObject({
    entries: kanaRecord(learnEntrySchema, BATCH_CAPS.kana),
    unlocked: v.strictObject({ hiragana: kanaList, katakana: kanaList }),
    recent: kanaRecord(
      v.pipe(v.array(recallAnswerSchema), v.maxLength(RECENT_ANSWERS)),
      BATCH_CAPS.kana,
    ),
    stats: kanaRecord(learnStatSchema, BATCH_CAPS.kana),
    activeDays,
    recallBuckets: v.strictObject({ hiragana: dayBuckets, katakana: dayBuckets }),
  }),
  // The cap of Q1 counts a kana once, whether it has an entry, answers or statistics.
  v.check(
    (delta) =>
      new Set([
        ...Object.keys(delta.entries),
        ...Object.keys(delta.recent),
        ...Object.keys(delta.stats),
      ]).size <= BATCH_CAPS.kana,
    'too many kana',
  ),
) satisfies v.GenericSchema<unknown, LearnDelta>;

// Typing statistics

const kanaStatSchema = v.pipe(
  v.strictObject({ attempts: count, erroredAttempts: count }),
  v.check((stat) => stat.erroredAttempts <= stat.attempts, 'more errors than attempts'),
) satisfies v.GenericSchema<unknown, KanaStat>;

const modeCounts = v.strictObject({ typing: count, learn: count });

const countersSchema = v.strictObject({
  started: modeCounts,
  finished: modeCounts,
}) satisfies v.GenericSchema<unknown, Counters>;

const syncDeltaSchema = v.strictObject({
  kanaStats: kanaRecord(kanaStatSchema, KANA_TOTAL),
  counters: countersSchema,
  learn: learnDeltaSchema,
  settings: v.nullable(settingsSchema),
}) satisfies v.GenericSchema<unknown, SyncDelta>;

// Requests

export const syncRequestSchema = v.strictObject({
  v: v.literal(1),
  deviceId: deviceIdSchema,
  seq: v.pipe(v.number(), v.integer(), v.minValue(1), v.maxValue(Number.MAX_SAFE_INTEGER)),
  delta: syncDeltaSchema,
  results: v.pipe(v.array(testResultSchema), v.maxLength(MAX_RESULTS_PER_BATCH)),
}) satisfies v.GenericSchema<unknown, SyncRequest>;

export const reportRequestSchema = v.strictObject({
  itemId: v.pipe(v.string(), v.minLength(1), v.maxLength(SHORT_TEXT)),
  contentVersion: v.pipe(v.string(), v.maxLength(SHORT_TEXT)),
  reason: v.picklist(['wrong_reading', 'wrong_translation', 'other']),
  comment: v.exactOptional(v.pipe(v.string(), v.maxLength(REPORT_COMMENT_MAX))),
  turnstileToken: v.pipe(v.string(), v.minLength(1), v.maxLength(2048)),
}) satisfies v.GenericSchema<unknown, ReportRequest>;

/** `GET /api/results?before=<endedAt>:<id>&limit=`: query values are strings. */
export const resultsQuerySchema = v.strictObject({
  before: v.exactOptional(v.pipe(v.string(), v.regex(/^-?\d+(\.\d+)?:[\w-]{1,64}$/))),
  limit: v.exactOptional(
    v.pipe(
      v.string(),
      v.regex(/^\d{1,2}$/),
      v.transform(Number),
      v.integer(),
      v.minValue(1),
      v.maxValue(50),
    ),
  ),
});

/** The validated batch, or `null`: the server answers `400` and logs nothing of the body. */
export function parseSyncRequest(input: unknown): SyncRequest | null {
  const parsed = v.safeParse(syncRequestSchema, input);
  return parsed.success ? parsed.output : null;
}

export function parseDeviceId(input: unknown): string | null {
  const parsed = v.safeParse(deviceIdSchema, input);
  return parsed.success ? parsed.output : null;
}
