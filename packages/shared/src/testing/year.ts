import { BATCH_CAPS } from '../sync-runtime';
import { SYNC_FORMAT_VERSION } from '../sync-format';
import type {
  Counters,
  DayBuckets,
  LearnDelta,
  LearnEntry,
  LearnKanaKey,
  LearnState,
  LearnStat,
  RecallAnswer,
  SyncRequest,
  Track,
} from '../types';
import type { KanaKeys } from './kana-keys';
import { intIn, seededRng } from './rng';
import type { Rng } from '../types';

// A year of daily learning on both tracks, the data of ADR 078: 229 kana with 10 recall answers
// each, 365 days of buckets per track with about 25 buckets a day, statistics for every kana,
// and three devices. For tests and measurements only.

/** The first day of the year, as a day number. */
export const YEAR_FIRST_DAY = 20_400;
const DAY_MS = 86_400_000;
const TRACKS: readonly Track[] = ['hiragana', 'katakana'];
const BOXES = [1, 2, 3, 4, 5] as const;

export type DeviceSeq = Record<string, { seq: number; at: number }>;

export type Year = {
  learn: LearnState;
  counters: Counters;
  deviceSeq: DeviceSeq;
};

export type BatchKind = 'learning' | 'capped';

/** The device that sends the generated batches; its `seq` in the year is `LAST_SEQ`. */
export const DEVICE_ID = '0a0a0a0a-0a0a-4a0a-8a0a-0a0a0a0a0a0a';
export const LAST_SEQ = 400;

function pickOne<T>(rng: Rng, items: readonly T[]): T {
  const item = items[intIn(rng, 0, items.length - 1)];
  if (item === undefined) throw new Error('pickOne: empty list');
  return item;
}

function dayBuckets(rng: Rng, answers: number): Record<string, number> {
  const buckets: Record<string, number> = {};
  for (let i = 0; i < answers; i += 1) {
    const bucket = String(intIn(rng, 4, 40));
    buckets[bucket] = (buckets[bucket] ?? 0) + 1;
  }
  return buckets;
}

function yearOfBuckets(rng: Rng): DayBuckets {
  const days: Record<string, Record<string, number>> = {};
  for (let i = 0; i < 365; i += 1) days[String(YEAR_FIRST_DAY + i)] = dayBuckets(rng, 45);
  return days;
}

function answers(rng: Rng, count: number, lastAt: number): RecallAnswer[] {
  const list: RecallAnswer[] = [];
  for (let i = 0; i < count; i += 1) {
    list.push({
      at: lastAt - (count - i) * intIn(rng, 20_000, 90_000),
      ms: intIn(rng, 600, 4200),
      ok: rng.next() > 0.12,
    });
  }
  // Oldest first, as the client keeps them.
  return list.sort((a, b) => a.at - b.at);
}

function learnStat(rng: Rng, all: readonly LearnKanaKey[], own: LearnKanaKey): LearnStat {
  const mixups: Record<string, number> = {};
  for (let i = 0; i < 3; i += 1) {
    const other = pickOne(rng, all);
    if (other !== own) mixups[other] = intIn(rng, 1, 9);
  }
  const recognitions = intIn(rng, 20, 190);
  return { recognitions, recognitionErrors: intIn(rng, 0, recognitions >> 3), mixups };
}

export function generateYear(options: { seed: number; keys: KanaKeys }): Year {
  const rng = seededRng(options.seed);
  const all = [...options.keys.hiragana, ...options.keys.katakana];
  const lastAt = (YEAR_FIRST_DAY + 364) * DAY_MS + 12 * 3_600_000;

  const entries: Record<string, LearnEntry> = {};
  const recent: Record<string, RecallAnswer[]> = {};
  const stats: Record<string, LearnStat> = {};
  for (const key of all) {
    entries[key] = {
      box: pickOne(rng, BOXES),
      dueAt: lastAt + intIn(rng, 1, 30) * DAY_MS,
      updatedAt: lastAt - intIn(rng, 0, 300) * DAY_MS,
    };
    recent[key] = answers(rng, 10, lastAt);
    stats[key] = learnStat(rng, all, key);
  }

  const activeDays: [number, number][] = [];
  for (let first = YEAR_FIRST_DAY; first < YEAR_FIRST_DAY + 365;) {
    const last = Math.min(YEAR_FIRST_DAY + 364, first + intIn(rng, 4, 30));
    activeDays.push([first, last]);
    first = last + 2;
  }

  const learn: LearnState = {
    unlocked: {
      hiragana: [...options.keys.hiragana].sort(),
      katakana: [...options.keys.katakana].sort(),
    },
    entries,
    recent,
    stats,
    activeDays,
    recallBuckets: { hiragana: yearOfBuckets(rng), katakana: yearOfBuckets(rng) },
  };
  return {
    learn,
    counters: { started: 380, finished: 365 },
    deviceSeq: {
      [DEVICE_ID]: { seq: LAST_SEQ, at: lastAt },
      'device-b': { seq: 120, at: lastAt - 20 * DAY_MS },
      'device-c': { seq: 33, at: lastAt - 90 * DAY_MS },
    },
  };
}

function emptyLearnDelta(): LearnDelta {
  return {
    entries: {},
    unlocked: { hiragana: [], katakana: [] },
    recent: {},
    stats: {},
    activeDays: [],
    recallBuckets: { hiragana: {}, katakana: {} },
  };
}

/** `count` kana, taken evenly from the tracks in `tracks`. */
function learningDelta(
  rng: Rng,
  keys: KanaKeys,
  tracks: readonly Track[],
  count: number,
  days: readonly number[],
): LearnDelta {
  const all = [...keys.hiragana, ...keys.katakana];
  const entries: Record<string, LearnEntry> = {};
  const recent: Record<string, RecallAnswer[]> = {};
  const stats: Record<string, LearnStat> = {};
  const now = (days[days.length - 1] ?? YEAR_FIRST_DAY) * DAY_MS + 12 * 3_600_000;
  for (let i = 0; i < count; i += 1) {
    const track = tracks[i % tracks.length] ?? 'hiragana';
    const key = keys[track][Math.floor(i / tracks.length)];
    if (key === undefined) throw new Error('learningDelta: not enough kana');
    entries[key] = { box: 3, dueAt: now + 3 * DAY_MS, updatedAt: now };
    recent[key] = answers(rng, 2, now);
    const stat = learnStat(rng, all, key);
    stats[key] = { ...stat, recognitions: 3, recognitionErrors: 0 };
  }
  const recallBuckets: Record<Track, Record<string, Record<string, number>>> = {
    hiragana: {},
    katakana: {},
  };
  for (const track of tracks) {
    for (const day of days) recallBuckets[track][String(day)] = dayBuckets(rng, 45);
  }
  const first = days[0] ?? YEAR_FIRST_DAY;
  const last = days[days.length - 1] ?? first;
  return {
    ...emptyLearnDelta(),
    entries,
    recent,
    stats,
    activeDays: [[first, last]],
    recallBuckets,
  };
}

/** A batch of the kind D14 names, for a device whose last applied `seq` is `LAST_SEQ`. */
export function generateBatch(options: {
  seed: number;
  keys: KanaKeys;
  kind: BatchKind;
}): SyncRequest {
  const rng = seededRng(options.seed);
  const { keys } = options;
  const lastDay = YEAR_FIRST_DAY + 364;
  const base = { v: SYNC_FORMAT_VERSION, deviceId: DEVICE_ID, seq: LAST_SEQ + 1 } as const;

  if (options.kind === 'learning') {
    // 30 kana of one track and one new day: the day also pushes the oldest day out.
    const learn = learningDelta(rng, keys, ['hiragana'], 30, [lastDay + 2]);
    return { ...base, delta: { counters: learnCounters(), learn, settings: null } };
  }
  const days: number[] = [];
  for (let i = 0; i < BATCH_CAPS.days; i += 1) days.push(lastDay - BATCH_CAPS.days + 1 + i);
  const learn = learningDelta(rng, keys, TRACKS, BATCH_CAPS.kana, days);
  return { ...base, delta: { counters: learnCounters(), learn, settings: null } };
}

function learnCounters(): Counters {
  return { started: 1, finished: 1 };
}
