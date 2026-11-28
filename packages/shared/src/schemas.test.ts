import * as v from 'valibot';
import { describe, expect, it } from 'vitest';
import { isSettings } from './runtime';
import { deviceIdSchema, reportRequestSchema, settingsSchema, syncRequestSchema } from './schemas';

const ID = '0192f0a0-0000-7000-8000-000000000001';

const settings = {
  learn: { strictness: 'learner', track: 'hiragana', sound: true },
  updatedAt: 0,
};

const ok = (schema: v.GenericSchema, value: unknown) => v.safeParse(schema, value).success;

describe('the schemas agree with the guards of shared/runtime', () => {
  const settingsCases: unknown[] = [
    settings,
    { ...settings, learn: { ...settings.learn, targetMs: 1500 } },
    { ...settings, learn: { ...settings.learn, extra: 1 } },
    { ...settings, learn: { ...settings.learn, track: 'both' } },
    { ...settings, learn: { ...settings.learn, sound: 1 } },
    { ...settings, updatedAt: '0' },
    { ...settings, typing: { script: 'both' } },
    { ...settings, extra: 1 },
    { updatedAt: 0 },
    null,
    [],
  ];
  it.each(settingsCases.map((value, index) => [index, value] as const))(
    'settings case %i',
    (_index, value) => {
      expect(ok(settingsSchema, value)).toBe(isSettings(value));
    },
  );
});

describe('syncRequestSchema (format 4)', () => {
  const page = { dev: ID, n0: 1, at0: 5, e: [[0, 'e']] };
  const batch = { v: 4, deviceId: ID, seq: 1, after: 0, log: page, settings: null };

  it('accepts a batch with a log, with settings and with neither', () => {
    expect(ok(syncRequestSchema, batch)).toBe(true);
    expect(ok(syncRequestSchema, { ...batch, log: null, settings })).toBe(true);
    expect(ok(syncRequestSchema, { ...batch, log: null })).toBe(true);
  });

  it('rejects the delta format and any other version', () => {
    for (const version of [1, 2, 3, 5])
      expect(ok(syncRequestSchema, { ...batch, v: version })).toBe(false);
    expect(ok(syncRequestSchema, { v: 2, deviceId: ID, seq: 1, delta: {} })).toBe(false);
  });

  it('checks the envelope: device, seq and after', () => {
    expect(ok(syncRequestSchema, { ...batch, deviceId: 'device-a' })).toBe(false);
    expect(ok(syncRequestSchema, { ...batch, seq: 0 })).toBe(false);
    expect(ok(syncRequestSchema, { ...batch, seq: 1.5 })).toBe(false);
    expect(ok(syncRequestSchema, { ...batch, after: -1 })).toBe(false);
    expect(ok(syncRequestSchema, { ...batch, after: undefined })).toBe(false);
  });

  it('rejects an unknown key, an invalid page and settings with a typing block', () => {
    expect(ok(syncRequestSchema, { ...batch, extra: true })).toBe(false);
    expect(ok(syncRequestSchema, { ...batch, log: { ...page, e: [] } })).toBe(false);
    expect(ok(syncRequestSchema, { ...batch, settings: { ...settings, typing: {} } })).toBe(false);
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
});
