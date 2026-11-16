import { personalBestKey } from '../typing-runtime';
import type {
  Counters,
  DayBuckets,
  KanaStat,
  LearnDelta,
  LearnEntry,
  LearnKanaKey,
  LearnState,
  LearnStat,
  RecallAnswer,
  SyncRequest,
  TestResult,
  Track,
  TypingRecords,
} from '../types';
import type { KanaKeys } from './kana-keys';
import { intIn, seededRng } from './rng';
import type { Rng } from '../types';

// A year of daily learning on both tracks, the data of ADR 078: 229 kana with 10 recall answers
// each, 365 days of buckets per track with about 25 buckets a day, statistics for every kana,
// records for 12 modes and three devices. For tests and measurements only.

/** The caps on the learning part of a batch (p5-plan.md, Q1). */
export const BATCH_CAPS = { kana: 60, days: 31 } as const;

/** The first day of the year, as a day number. */
export const YEAR_FIRST_DAY = 20_400;
const DAY_MS = 86_400_000;
const TRACKS: readonly Track[] = ['hiragana', 'katakana'];
const BOXES = [1, 2, 3, 4, 5] as const;

export type DeviceSeq = Record<string, { seq: number; at: number }>;

export type Year = {
  learn: LearnState;
  kanaStats: Record<LearnKanaKey, KanaStat>;
  counters: Counters;
  typingRecords: TypingRecords;
  deviceSeq: DeviceSeq;
};

export type BatchKind = 'learning' | 'capped' | 'results';

/** The device that sends the generated batches; its `seq` in the year is `LAST_SEQ`. */
export const DEVICE_ID = 'device-a';
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
  return list;
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

function typingRecords(rng: Rng): TypingRecords {
  const records: Record<string, TypingRecords[string]> = {};
  for (const content of ['words', 'phrases'] as const) {
    for (const script of ['hiragana', 'katakana', 'both'] as const) {
      for (const strictness of ['learner', 'ime'] as const) {
        const key = personalBestKey({
          content,
          script,
          strictness,
          config: { kind: 'time', seconds: 60 },
        });
        const recent = [];
        for (let i = 0; i < 10; i += 1) {
          recent.push({
            resultId: resultId(rng, YEAR_FIRST_DAY * DAY_MS + i * 3_600_000),
            endedAt: (YEAR_FIRST_DAY + 300) * DAY_MS + i * 3_600_000,
            kpm: intIn(rng, 400, 900) / 10,
          });
        }
        records[key] = { best: { kpm: 91.5, resultId: resultId(rng, 1) }, recent };
      }
    }
  }
  return records;
}

function hex(rng: Rng, digits: number): string {
  let out = '';
  for (let i = 0; i < digits; i += 1) out += intIn(rng, 0, 15).toString(16);
  return out;
}

/** A UUID-shaped id that sorts by time, like a UUID v7. */
function resultId(rng: Rng, at: number): string {
  const time = at.toString(16).padStart(12, '0');
  return `${time.slice(0, 8)}-${time.slice(8)}-7${hex(rng, 3)}-8${hex(rng, 3)}-${hex(rng, 12)}`;
}

export function generateYear(options: { seed: number; keys: KanaKeys }): Year {
  const rng = seededRng(options.seed);
  const all = [...options.keys.hiragana, ...options.keys.katakana];
  const lastAt = (YEAR_FIRST_DAY + 364) * DAY_MS + 12 * 3_600_000;

  const entries: Record<string, LearnEntry> = {};
  const recent: Record<string, RecallAnswer[]> = {};
  const stats: Record<string, LearnStat> = {};
  const kanaStats: Record<string, KanaStat> = {};
  for (const key of all) {
    entries[key] = {
      box: pickOne(rng, BOXES),
      dueAt: lastAt + intIn(rng, 1, 30) * DAY_MS,
      updatedAt: lastAt - intIn(rng, 0, 300) * DAY_MS,
    };
    recent[key] = answers(rng, 10, lastAt);
    stats[key] = learnStat(rng, all, key);
    const attempts = intIn(rng, 40, 190);
    kanaStats[key] = { attempts, erroredAttempts: intIn(rng, 0, attempts >> 3) };
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
    kanaStats,
    counters: {
      started: { typing: 120, learn: 380 },
      finished: { typing: 100, learn: 365 },
    },
    typingRecords: typingRecords(rng),
    deviceSeq: {
      [DEVICE_ID]: { seq: LAST_SEQ, at: lastAt },
      'device-b': { seq: 120, at: lastAt - 20 * DAY_MS },
      'device-c': { seq: 33, at: lastAt - 90 * DAY_MS },
    },
  };
}

const NO_COUNTERS: Counters = {
  started: { typing: 0, learn: 0 },
  finished: { typing: 0, learn: 0 },
};

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

function generateResults(rng: Rng, count: number): TestResult[] {
  const results: TestResult[] = [];
  const base = (YEAR_FIRST_DAY + 366) * DAY_MS;
  for (let i = 0; i < count; i += 1) {
    const endedAt = base + i * 120_000;
    results.push({
      id: resultId(rng, endedAt),
      content: 'words',
      script: 'hiragana',
      strictness: 'learner',
      config: { kind: 'time', seconds: 60 },
      endReason: 'complete',
      repeated: false,
      startedAt: endedAt - 60_000,
      endedAt,
      durationMs: 60_000,
      tokens: 90,
      erroredTokens: 6,
      items: 24,
      keystrokes: 150,
      rejectedKeystrokes: 4,
      assisted: 0,
      kpm: intIn(rng, 400, 900) / 10,
      kanaAccuracy: 0.9333,
      celebratedPersonalBest: false,
      contentVersion: '2026-11-01',
      appVersion: '1.0.0',
    });
  }
  return results;
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
  const base = { v: 1, deviceId: DEVICE_ID, seq: LAST_SEQ + 1 } as const;

  if (options.kind === 'learning') {
    // 30 kana of one track and one new day: the day also pushes the oldest day out.
    const learn = learningDelta(rng, keys, ['hiragana'], 30, [lastDay + 2]);
    return {
      ...base,
      delta: { kanaStats: {}, counters: learnCounters(), learn, settings: null },
      results: [],
    };
  }
  if (options.kind === 'capped') {
    const days: number[] = [];
    for (let i = 0; i < BATCH_CAPS.days; i += 1) days.push(lastDay - BATCH_CAPS.days + 1 + i);
    const learn = learningDelta(rng, keys, TRACKS, BATCH_CAPS.kana, days);
    return {
      ...base,
      delta: { kanaStats: {}, counters: learnCounters(), learn, settings: null },
      results: [],
    };
  }
  const kanaStats: Record<string, KanaStat> = {};
  for (const key of keys.hiragana.slice(0, 46)) {
    kanaStats[key] = { attempts: intIn(rng, 5, 40), erroredAttempts: intIn(rng, 0, 3) };
  }
  return {
    ...base,
    delta: {
      kanaStats,
      counters: {
        started: { typing: 50, learn: 0 },
        finished: { typing: 50, learn: 0 },
      },
      learn: emptyLearnDelta(),
      settings: null,
    },
    results: generateResults(rng, 50),
  };
}

function learnCounters(): Counters {
  return {
    ...NO_COUNTERS,
    started: { typing: 0, learn: 1 },
    finished: { typing: 0, learn: 1 },
  };
}
