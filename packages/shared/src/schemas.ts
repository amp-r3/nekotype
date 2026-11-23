import * as v from 'valibot';
import { isLogPage } from './log-codec';
import { SYNC_FORMAT_VERSION } from './sync-format';
import type { LogPage, ReportRequest, SyncRequest, ValidSettings } from './types';

// The valibot schemas of the API (p5-plan.md, D10). Server only: the client imports `shared/types`
// and `shared/runtime`, so valibot never reaches its bundle (lint rule in apps/web). Each schema is
// declared against its type, so the two cannot drift apart at compile time. Objects are strict: an
// unknown key is a `400`, never dropped in silence (A28).

const SHORT_TEXT = 64;
export const REPORT_COMMENT_MAX = 500;

const finite = v.pipe(v.number(), v.finite());

export const deviceIdSchema = v.pipe(v.string(), v.uuid());

// Settings

const strictness = v.picklist(['learner', 'ime']);

export const settingsSchema = v.strictObject({
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

// Requests

const seq = v.pipe(v.number(), v.integer(), v.minValue(1), v.maxValue(Number.MAX_SAFE_INTEGER));

/** Sync format 3 (P7 plan, D12, D14): the events are checked by the codec's guard, not by valibot. */
export const syncRequestSchema = v.strictObject({
  v: v.literal(SYNC_FORMAT_VERSION),
  deviceId: deviceIdSchema,
  seq,
  after: v.pipe(v.number(), v.integer(), v.minValue(0), v.maxValue(Number.MAX_SAFE_INTEGER)),
  log: v.nullable(v.custom<LogPage>(isLogPage, 'not a log page')),
  settings: v.nullable(settingsSchema),
}) satisfies v.GenericSchema<unknown, SyncRequest>;

export const reportRequestSchema = v.strictObject({
  itemId: v.pipe(v.string(), v.minLength(1), v.maxLength(SHORT_TEXT)),
  contentVersion: v.pipe(v.string(), v.maxLength(SHORT_TEXT)),
  reason: v.picklist(['wrong_reading', 'wrong_translation', 'other']),
  comment: v.exactOptional(v.pipe(v.string(), v.maxLength(REPORT_COMMENT_MAX))),
  turnstileToken: v.pipe(v.string(), v.minLength(1), v.maxLength(2048)),
}) satisfies v.GenericSchema<unknown, ReportRequest>;

/** The validated batch of format 3, or `null`. */
export function parseSyncRequest(input: unknown): SyncRequest | null {
  const parsed = v.safeParse(syncRequestSchema, input);
  return parsed.success ? parsed.output : null;
}

export function parseReportRequest(input: unknown): ReportRequest | null {
  const parsed = v.safeParse(reportRequestSchema, input);
  return parsed.success ? parsed.output : null;
}

/** The `after` of a pull: a non-negative integer in its decimal form, or `null`. */
export function parseAfter(input: unknown): number | null {
  if (typeof input !== 'string' || !/^\d{1,16}$/.test(input)) return null;
  const after = Number(input);
  return Number.isSafeInteger(after) ? after : null;
}

export function parseDeviceId(input: unknown): string | null {
  const parsed = v.safeParse(deviceIdSchema, input);
  return parsed.success ? parsed.output : null;
}
