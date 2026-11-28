import { describe, expect, it } from 'vitest';
import { MAX_SYNC_BODY_BYTES, isSyncResponse, mergeSettings, readPullResponse } from './runtime';
import type { ValidSettings } from './types';

function settings(updatedAt: number, track: 'hiragana' | 'katakana' = 'hiragana'): ValidSettings {
  return {
    learn: { strictness: 'learner', track, sound: true },
    updatedAt,
  };
}

describe('constants', () => {
  it('are the values of the spec', () => {
    expect(MAX_SYNC_BODY_BYTES).toBe(262_144);
  });
});

describe('guards', () => {
  it('isSyncResponse (format 4)', () => {
    expect(isSyncResponse({ lastSeq: 0, more: false })).toBe(true);
    expect(isSyncResponse({ lastSeq: 2, more: 1 })).toBe(false);
    expect(isSyncResponse({ lastSeq: -1, more: true })).toBe(false);
    expect(isSyncResponse({ lastSeq: 1 })).toBe(false);
    expect(isSyncResponse(null)).toBe(false);
  });

  it('readPullResponse checks the pages of the rows', () => {
    const page = { dev: '0190f3a0-0000-7000-8000-000000000001', n0: 1, at0: 5, e: [[0, 'e']] };
    const body = { last: 4, more: false, settings: null, rows: [{ id: 4, log: page }] };
    expect(readPullResponse(body)).toEqual(body);
    expect(readPullResponse({ ...body, rows: [] })).toEqual({ ...body, rows: [] });
    expect(readPullResponse({ ...body, rows: [{ id: 4, log: { ...page, e: [] } }] })).toBeNull();
    expect(readPullResponse({ ...body, rows: [{ id: -1, log: page }] })).toBeNull();
    expect(readPullResponse({ ...body, more: 'no' })).toBeNull();
    expect(readPullResponse({ ...body, settings: 3 })).toBeNull();
    expect(readPullResponse({ ...body, last: 1.5 })).toBeNull();
    expect(readPullResponse(null)).toBeNull();
  });

  it('readPullResponse reads settings of earlier versions without the target answer time', () => {
    const body = { last: 4, more: false, settings: settings(7, 'katakana'), rows: [] };
    expect(readPullResponse(body)?.settings).toEqual(settings(7, 'katakana'));
    const learn = { ...settings(7, 'katakana').learn, targetMs: 1500 };
    const legacy = { ...body, settings: { learn, updatedAt: 7 } };
    expect(readPullResponse(legacy)?.settings).toEqual(settings(7, 'katakana'));
    const other = { ...body, settings: { learn: { ...learn, extra: 1 }, updatedAt: 7 } };
    expect(readPullResponse(other)).toBeNull();
  });
});

describe('mergeSettings', () => {
  it('last write wins on updatedAt', () => {
    expect(mergeSettings(settings(5), settings(9, 'katakana'), 7)?.learn.track).toBe('katakana');
    expect(mergeSettings(settings(9), settings(5, 'katakana'), 7)?.learn.track).toBe('hiragana');
    expect(mergeSettings(settings(5), null, 7)?.updatedAt).toBe(5);
    expect(mergeSettings(null, settings(5), 7)?.updatedAt).toBe(5);
  });

  it('on seq 1 the account settings win, and a new account takes the guest settings', () => {
    expect(mergeSettings(settings(5), settings(99, 'katakana'), 1)?.learn.track).toBe('hiragana');
    expect(mergeSettings(null, settings(99, 'katakana'), 1)?.learn.track).toBe('katakana');
  });
});
