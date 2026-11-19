import { describe, expect, it } from 'vitest';
import {
  MAX_RESULTS_PER_BATCH,
  MAX_SYNC_BODY_BYTES,
  SYNC_FORMAT_VERSION,
  applyBatch,
  emptyLearnState,
  isSnapshot,
  isSnapshotBuckets,
  isSnapshotRecent,
  isSnapshotRest,
  isSyncResponse,
  isResultsResponse,
  mergeSettings,
  outboxDelta,
} from './runtime';
import { KANA_KEYS, generateYear } from './testing';
import type { Snapshot, SyncRequest, ValidSettings } from './types';

const year = generateYear({ seed: 3, keys: KANA_KEYS });
const snapshot: Snapshot = {
  settings: null,
  kanaStats: year.kanaStats,
  counters: year.counters,
  learn: year.learn,
  typingRecords: year.typingRecords,
};

function settings(updatedAt: number, targetMs = 1500): ValidSettings {
  return {
    typing: {
      script: 'both',
      content: 'words',
      strictness: 'learner',
      weakFocus: false,
      test: { kind: 'zen' },
      showTranslation: true,
    },
    learn: { strictness: 'learner', track: 'hiragana', targetMs, sound: true },
    updatedAt,
  };
}

describe('constants', () => {
  it('are the values of the spec', () => {
    expect(SYNC_FORMAT_VERSION).toBe(1);
    expect(MAX_RESULTS_PER_BATCH).toBe(50);
    expect(MAX_SYNC_BODY_BYTES).toBe(262_144);
  });
});

describe('guards', () => {
  const { recent, recallBuckets, ...rest } = snapshot.learn;

  it('isResultsResponse', () => {
    expect(isResultsResponse({ results: [], next: null })).toBe(true);
    expect(isResultsResponse({ results: [], next: '1:a' })).toBe(true);
    expect(isResultsResponse({ results: [], next: '' })).toBe(false);
    expect(isResultsResponse({ results: [], next: 5 })).toBe(false);
    expect(isResultsResponse({ results: [{ id: 'x' }], next: null })).toBe(false);
    expect(isResultsResponse({ next: null })).toBe(false);
    expect(isResultsResponse(null)).toBe(false);
  });

  it('isSyncResponse', () => {
    expect(isSyncResponse({ lastSeq: 0, version: 3 })).toBe(true);
    expect(isSyncResponse({ lastSeq: -1, version: 3 })).toBe(false);
    expect(isSyncResponse({ lastSeq: 1.5, version: 3 })).toBe(false);
    expect(isSyncResponse({ lastSeq: 1 })).toBe(false);
    expect(isSyncResponse(null)).toBe(false);
  });

  it('isSnapshot takes a whole snapshot and nothing broken', () => {
    expect(isSnapshot(snapshot)).toBe(true);
    expect(isSnapshot({ ...snapshot, settings: settings(1) })).toBe(true);
    expect(isSnapshot({ ...snapshot, settings: { updatedAt: 1 } })).toBe(false);
    expect(isSnapshot({ ...snapshot, counters: {} })).toBe(false);
    expect(isSnapshot({ ...snapshot, kanaStats: { 'hiragana:あ': { attempts: 1 } } })).toBe(false);
    expect(isSnapshot({ ...snapshot, learn: rest })).toBe(false);
    expect(isSnapshot({ ...snapshot, typingRecords: { k: { best: 1 } } })).toBe(false);
    expect(isSnapshot(emptyLearnState())).toBe(false);
  });

  it('outboxDelta takes the delta of a batch of this format, unchecked', () => {
    const delta = { counters: 'not checked here' };
    const batch = {
      seq: 1,
      resultIds: [],
      request: { v: SYNC_FORMAT_VERSION, results: [], delta },
    };
    expect(outboxDelta(batch)).toBe(delta);
    expect(outboxDelta(undefined)).toBeNull();
    expect(outboxDelta({ ...batch, seq: -1 })).toBeNull();
    expect(outboxDelta({ ...batch, resultIds: null })).toBeNull();
    expect(outboxDelta({ ...batch, request: { ...batch.request, v: 2 } })).toBeNull();
    expect(outboxDelta({ ...batch, request: { ...batch.request, results: {} } })).toBeNull();
    expect(outboxDelta({ ...batch, request: { ...batch.request, delta: [] } })).toBeNull();
  });

  it('isSnapshotRest, isSnapshotRecent and isSnapshotBuckets check the part and the version', () => {
    const part = {
      part: 'rest',
      lastSeq: 4,
      version: 9,
      settings: null,
      kanaStats: snapshot.kanaStats,
      counters: snapshot.counters,
      learn: rest,
      typingRecords: snapshot.typingRecords,
    };
    expect(isSnapshotRest(part)).toBe(true);
    expect(isSnapshotRest({ ...part, part: 'recent' })).toBe(false);
    expect(isSnapshotRest({ ...part, version: 'x' })).toBe(false);
    expect(isSnapshotRest({ ...part, learn: snapshot.learn.unlocked })).toBe(false);

    expect(isSnapshotRecent({ part: 'recent', version: 9, recent })).toBe(true);
    expect(isSnapshotRecent({ part: 'recent', version: 9, recent: { x: [] } })).toBe(false);
    expect(isSnapshotRecent({ part: 'buckets', version: 9, recent })).toBe(false);

    expect(isSnapshotBuckets({ part: 'buckets', version: 9, recallBuckets })).toBe(true);
    expect(
      isSnapshotBuckets({ part: 'buckets', version: 9, recallBuckets: { hiragana: {} } }),
    ).toBe(false);
    expect(isSnapshotBuckets({ part: 'recent', version: 9, recallBuckets })).toBe(false);
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

describe('applyBatch', () => {
  const request: SyncRequest = {
    v: 1,
    deviceId: 'd',
    seq: 1,
    delta: {
      kanaStats: {},
      counters: { started: { typing: 0, learn: 0 }, finished: { typing: 0, learn: 0 } },
      learn: emptyLearnState(),
      settings: settings(10),
    },
    results: [],
  };

  it('an empty batch changes nothing but the settings of a new account', () => {
    const applied = applyBatch(snapshot, request);
    expect(applied.settings).toEqual(settings(10));
    expect(applied.kanaStats).toEqual(snapshot.kanaStats);
    expect(applied.counters).toEqual(snapshot.counters);
    expect(applied.typingRecords).toEqual(snapshot.typingRecords);
  });
});
