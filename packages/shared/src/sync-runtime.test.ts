import { describe, expect, it } from 'vitest';
import { MAX_SYNC_BODY_BYTES, isPullResponse, isSyncResponse, mergeSettings } from './runtime';
import type { ValidSettings } from './types';

function settings(updatedAt: number, targetMs = 1500): ValidSettings {
  return {
    learn: { strictness: 'learner', track: 'hiragana', targetMs, sound: true },
    updatedAt,
  };
}

describe('constants', () => {
  it('are the values of the spec', () => {
    expect(MAX_SYNC_BODY_BYTES).toBe(262_144);
  });
});

describe('guards', () => {
  it('isSyncResponse (format 3)', () => {
    expect(isSyncResponse({ lastSeq: 0, more: false })).toBe(true);
    expect(isSyncResponse({ lastSeq: 2, more: 1 })).toBe(false);
    expect(isSyncResponse({ lastSeq: -1, more: true })).toBe(false);
    expect(isSyncResponse({ lastSeq: 1 })).toBe(false);
    expect(isSyncResponse(null)).toBe(false);
  });

  it('isPullResponse checks the pages of the rows', () => {
    const page = { dev: '0190f3a0-0000-7000-8000-000000000001', n0: 1, at0: 5, e: [[0, 'e']] };
    const body = { last: 4, more: false, settings: null, rows: [{ id: 4, log: page }] };
    expect(isPullResponse(body)).toBe(true);
    expect(isPullResponse({ ...body, rows: [] })).toBe(true);
    expect(isPullResponse({ ...body, rows: [{ id: 4, log: { ...page, e: [] } }] })).toBe(false);
    expect(isPullResponse({ ...body, rows: [{ id: -1, log: page }] })).toBe(false);
    expect(isPullResponse({ ...body, more: 'no' })).toBe(false);
    expect(isPullResponse({ ...body, settings: 3 })).toBe(false);
    expect(isPullResponse({ ...body, last: 1.5 })).toBe(false);
    expect(isPullResponse(null)).toBe(false);
  });
});

describe('mergeSettings', () => {
  it('last write wins on updatedAt', () => {
    expect(mergeSettings(settings(5), settings(9, 2000), 7)?.learn.targetMs).toBe(2000);
    expect(mergeSettings(settings(9), settings(5, 2000), 7)?.learn.targetMs).toBe(1500);
    expect(mergeSettings(settings(5), null, 7)?.updatedAt).toBe(5);
    expect(mergeSettings(null, settings(5), 7)?.updatedAt).toBe(5);
  });

  it('on seq 1 the account settings win, and a new account takes the guest settings', () => {
    expect(mergeSettings(settings(5), settings(99, 2000), 1)?.learn.targetMs).toBe(1500);
    expect(mergeSettings(null, settings(99, 2000), 1)?.learn.targetMs).toBe(2000);
  });
});
