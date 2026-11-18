import * as v from 'valibot';
import { describe, expect, it } from 'vitest';
import { KANA_KEYS, generateBatch } from './testing';
import { isObject, isSettings, isTestResult, BATCH_CAPS } from './runtime';
import {
  deviceIdSchema,
  reportRequestSchema,
  resultsQuerySchema,
  settingsSchema,
  syncRequestSchema,
  testResultSchema,
} from './schemas';
import type { SyncRequest, TestResult } from './types';

const ID = '0192f0a0-0000-7000-8000-000000000001';

const settings = {
  typing: {
    script: 'both',
    content: 'words',
    strictness: 'learner',
    weakFocus: true,
    test: { kind: 'time', seconds: 30 },
    showTranslation: true,
  },
  learn: { strictness: 'learner', track: 'hiragana', targetMs: 1500, sound: true },
  updatedAt: 0,
};

const result: TestResult = {
  id: ID,
  content: 'words',
  script: 'hiragana',
  strictness: 'learner',
  config: { kind: 'time', seconds: 60 },
  endReason: 'complete',
  repeated: false,
  startedAt: 0,
  endedAt: 60_000,
  durationMs: 60_000,
  tokens: 100,
  erroredTokens: 5,
  items: 20,
  keystrokes: 150,
  rejectedKeystrokes: 5,
  assisted: 0,
  kpm: 100,
  kanaAccuracy: 0.95,
  celebratedPersonalBest: false,
  contentVersion: 'c1',
  appVersion: 'a1',
};

const ok = (schema: v.GenericSchema, value: unknown) => v.safeParse(schema, value).success;

describe('the schemas agree with the guards of shared/runtime', () => {
  const settingsCases: unknown[] = [
    settings,
    { ...settings, typing: { ...settings.typing, test: { kind: 'zen' } } },
    { ...settings, typing: { ...settings.typing, test: { kind: 'count', prompts: 100 } } },
    { ...settings, typing: { ...settings.typing, content: 'single' } },
    { ...settings, typing: { ...settings.typing, test: { kind: 'time', seconds: 45 } } },
    { ...settings, typing: { ...settings.typing, showTranslation: 'no' } },
    { ...settings, learn: { ...settings.learn, targetMs: 1000 } },
    { ...settings, learn: { ...settings.learn, targetMs: 3000 } },
    { ...settings, learn: { ...settings.learn, targetMs: 1100 } },
    { ...settings, learn: { ...settings.learn, targetMs: 3250 } },
    { ...settings, learn: { ...settings.learn, targetMs: Number.NaN } },
    { ...settings, learn: { ...settings.learn, track: 'both' } },
    { ...settings, learn: { ...settings.learn, sound: 1 } },
    { ...settings, updatedAt: '0' },
    { typing: settings.typing, updatedAt: 0 },
    { v: 1, ...settings.typing },
    null,
    [],
  ];
  it.each(settingsCases.map((value, index) => [index, value] as const))(
    'settings case %i',
    (_index, value) => {
      expect(ok(settingsSchema, value)).toBe(isSettings(value));
    },
  );

  const resultCases: unknown[] = [
    result,
    { ...result, config: { kind: 'zen' } },
    { ...result, config: { kind: 'count', prompts: 25 } },
    null,
    { ...result, endReason: 'crash' },
    { ...result, config: { kind: 'time' } },
    { ...result, config: { kind: 'time', seconds: 0 } },
    { ...result, kanaAccuracy: 1.2 },
    { ...result, kpm: Number.NaN },
    { ...result, kpm: -1 },
    { ...result, tokens: 1.5 },
    { ...result, erroredTokens: 101 },
    { ...result, repeated: 'no' },
    { ...result, celebratedPersonalBest: undefined },
  ];
  it.each(resultCases.map((value, index) => [index, value] as const))(
    'result case %i',
    (_index, value) => {
      expect(ok(testResultSchema, value)).toBe(isTestResult(value));
    },
  );

  it('differs from the guard only where the schema is stricter: a result id is a UUID', () => {
    expect(isTestResult({ ...result, id: 'r0' })).toBe(true);
    expect(ok(testResultSchema, { ...result, id: 'r0' })).toBe(false);
    expect(isTestResult({ ...result, id: '' })).toBe(false);
    expect(ok(testResultSchema, { ...result, id: '' })).toBe(false);
  });
});

describe('syncRequestSchema', () => {
  const kinds = ['learning', 'capped', 'results'] as const;
  it.each(kinds)('accepts the generated %s batch', (kind) => {
    const batch = generateBatch({ seed: 7, keys: KANA_KEYS, kind });
    expect(v.safeParse(syncRequestSchema, batch).success).toBe(true);
  });

  const learning = generateBatch({ seed: 7, keys: KANA_KEYS, kind: 'learning' });
  const mutate = (change: (batch: Record<string, unknown>) => void): unknown => {
    const parsed: unknown = JSON.parse(JSON.stringify(learning));
    if (!isObject(parsed)) throw new Error('not an object');
    const copy: Record<string, unknown> = { ...parsed };
    change(copy);
    return copy;
  };
  const delta = (batch: Record<string, unknown>): Record<string, unknown> => {
    const value = batch['delta'];
    if (!isObject(value)) throw new Error('no delta');
    return value;
  };
  const learnOf = (batch: Record<string, unknown>): Record<string, unknown> => {
    const value = delta(batch)['learn'];
    if (!isObject(value)) throw new Error('no learn');
    return value;
  };

  it('rejects an unknown key at any depth', () => {
    expect(ok(syncRequestSchema, { ...learning, extra: 1 })).toBe(false);
    expect(
      ok(
        syncRequestSchema,
        mutate((batch) => {
          batch['delta'] = { ...delta(batch), learn: { ...learnOf(batch), extra: {} } };
        }),
      ),
    ).toBe(false);
  });

  it('checks the envelope: format version, device and seq', () => {
    expect(ok(syncRequestSchema, { ...learning, v: 2 })).toBe(false);
    expect(ok(syncRequestSchema, { ...learning, deviceId: 'device-a' })).toBe(false);
    expect(ok(syncRequestSchema, { ...learning, seq: 0 })).toBe(false);
    expect(ok(syncRequestSchema, { ...learning, seq: 1.5 })).toBe(false);
    expect(ok(syncRequestSchema, { ...learning, seq: 1 })).toBe(true);
  });

  it('accepts at most 50 results', () => {
    const many = (count: number): SyncRequest => ({
      ...learning,
      results: Array.from({ length: count }, (_, index) => ({
        ...result,
        id: `0192f0a0-0000-7000-8000-${String(index).padStart(12, '0')}`,
      })),
    });
    expect(ok(syncRequestSchema, many(50))).toBe(true);
    expect(ok(syncRequestSchema, many(51))).toBe(false);
  });

  it('caps the kana of the learning part at 60 and the days of a track at 31', () => {
    const capped = generateBatch({ seed: 7, keys: KANA_KEYS, kind: 'capped' });
    expect(Object.keys(capped.delta.learn.entries).length).toBe(BATCH_CAPS.kana);
    expect(ok(syncRequestSchema, capped)).toBe(true);

    const extraKey = KANA_KEYS.katakana[40] ?? '';
    const stat = { recognitions: 1, recognitionErrors: 0, mixups: {} };
    const overKana = {
      ...capped,
      delta: {
        ...capped.delta,
        learn: {
          ...capped.delta.learn,
          stats: { ...capped.delta.learn.stats, [extraKey]: stat },
        },
      },
    };
    expect(Object.keys(overKana.delta.learn.stats)).toHaveLength(BATCH_CAPS.kana + 1);
    expect(ok(syncRequestSchema, overKana)).toBe(false);

    const days: Record<string, Record<string, number>> = {};
    for (let day = 0; day <= BATCH_CAPS.days; day += 1) days[String(20_000 + day)] = { '5': 1 };
    const overDays = {
      ...capped,
      delta: {
        ...capped.delta,
        learn: {
          ...capped.delta.learn,
          recallBuckets: { ...capped.delta.learn.recallBuckets, hiragana: days },
        },
      },
    };
    expect(ok(syncRequestSchema, overDays)).toBe(false);
  });

  it('bounds kana keys, recall answers, buckets and counts', () => {
    const withLearn = (patch: Record<string, unknown>): unknown =>
      mutate((batch) => {
        batch['delta'] = { ...delta(batch), learn: { ...learnOf(batch), ...patch } };
      });
    const answer = { at: 1, ms: 1000, ok: true };
    expect(ok(syncRequestSchema, withLearn({ recent: { 'hiragana:あ': [answer] } }))).toBe(true);
    expect(
      ok(syncRequestSchema, withLearn({ recent: { 'hiragana:あ': Array(11).fill(answer) } })),
    ).toBe(false);
    expect(
      ok(
        syncRequestSchema,
        withLearn({ recent: { 'hiragana:あ': [{ ...answer, ms: Number.POSITIVE_INFINITY }] } }),
      ),
    ).toBe(false);
    expect(ok(syncRequestSchema, withLearn({ recent: { 'latin:a': [answer] } }))).toBe(false);
    expect(
      ok(syncRequestSchema, withLearn({ recent: { [`hiragana:${'x'.repeat(16)}`]: [answer] } })),
    ).toBe(false);
    expect(
      ok(
        syncRequestSchema,
        withLearn({ recallBuckets: { hiragana: { '20000': { '100': 1 } }, katakana: {} } }),
      ),
    ).toBe(true);
    expect(
      ok(
        syncRequestSchema,
        withLearn({ recallBuckets: { hiragana: { '20000': { '101': 1 } }, katakana: {} } }),
      ),
    ).toBe(false);
    expect(
      ok(
        syncRequestSchema,
        withLearn({ recallBuckets: { hiragana: { '20000': { '5': -1 } }, katakana: {} } }),
      ),
    ).toBe(false);
    expect(ok(syncRequestSchema, withLearn({ activeDays: [[5, 3]] }))).toBe(false);
    expect(
      ok(
        syncRequestSchema,
        withLearn({
          activeDays: [
            [1, 3],
            [4, 5],
          ],
        }),
      ),
    ).toBe(false);
    expect(
      ok(
        syncRequestSchema,
        withLearn({
          activeDays: [
            [1, 3],
            [5, 6],
          ],
        }),
      ),
    ).toBe(true);
  });

  it('bounds the text fields of a result', () => {
    const withResult = (patch: Record<string, unknown>): unknown => ({
      ...learning,
      results: [{ ...result, ...patch }],
    });
    expect(ok(syncRequestSchema, withResult({ appVersion: 'a'.repeat(64) }))).toBe(true);
    expect(ok(syncRequestSchema, withResult({ appVersion: 'a'.repeat(65) }))).toBe(false);
    expect(ok(syncRequestSchema, withResult({ contentVersion: 'c'.repeat(65) }))).toBe(false);
  });
});

describe('the other schemas', () => {
  it('deviceIdSchema takes a UUID', () => {
    expect(ok(deviceIdSchema, ID)).toBe(true);
    expect(ok(deviceIdSchema, 'device-a')).toBe(false);
  });

  it('reportRequestSchema bounds the comment at 500 characters', () => {
    const base = {
      itemId: 'w-1',
      contentVersion: 'c1',
      reason: 'wrong_reading',
      turnstileToken: 't',
    };
    expect(ok(reportRequestSchema, base)).toBe(true);
    expect(ok(reportRequestSchema, { ...base, comment: 'x'.repeat(500) })).toBe(true);
    expect(ok(reportRequestSchema, { ...base, comment: 'x'.repeat(501) })).toBe(false);
    expect(ok(reportRequestSchema, { ...base, reason: 'spam' })).toBe(false);
  });

  it('resultsQuerySchema reads a cursor and a limit of 1–50', () => {
    expect(ok(resultsQuerySchema, {})).toBe(true);
    expect(ok(resultsQuerySchema, { before: `1700000000000:${ID}`, limit: '50' })).toBe(true);
    expect(ok(resultsQuerySchema, { limit: '51' })).toBe(false);
    expect(ok(resultsQuerySchema, { limit: '0' })).toBe(false);
    expect(ok(resultsQuerySchema, { before: 'x' })).toBe(false);
  });
});

describe('kana keys in JSON paths', () => {
  it('rejects a key with a quote or a backslash', () => {
    const batch = generateBatch({ seed: 7, keys: KANA_KEYS, kind: 'learning' });
    const entry = { box: 1, dueAt: 0, updatedAt: 0 };
    for (const key of ['hiragana:a"b', 'hiragana:a\\b']) {
      const learn = { ...batch.delta.learn, entries: { [key]: entry } };
      expect(ok(syncRequestSchema, { ...batch, delta: { ...batch.delta, learn } })).toBe(false);
    }
  });
});
