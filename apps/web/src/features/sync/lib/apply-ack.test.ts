import { describe, expect, it } from 'vitest';
import type { SnapshotBuckets, SnapshotRecent, SnapshotRest } from '@nekotype/shared/types';
import { emptyLearnState } from '@nekotype/shared/runtime';
import { emptyCounters, emptySnapshot, settingsAt } from '../model/test-util';
import { appliesLocally, assembleSnapshot, settingsAfter } from './apply-ack';

describe('appliesLocally', () => {
  const snapshot = emptySnapshot();
  it('is true for the stored version plus 1 only', () => {
    expect(appliesLocally(snapshot, 4, 5)).toBe(true);
    expect(appliesLocally(snapshot, 4, 4)).toBe(false);
    expect(appliesLocally(snapshot, 4, 6)).toBe(false);
  });
  it('is false without a snapshot', () => {
    expect(appliesLocally(null, 4, 5)).toBe(false);
    expect(appliesLocally(snapshot, null, 1)).toBe(false);
  });
});

describe('assembleSnapshot', () => {
  it('joins the three parts', () => {
    const { recent, recallBuckets, ...rest } = emptyLearnState();
    const part: SnapshotRest = {
      part: 'rest',
      lastSeq: 1,
      version: 2,
      settings: settingsAt(3),
      kanaStats: {},
      counters: emptyCounters(),
      learn: rest,
      typingRecords: {},
    };
    const recentPart: SnapshotRecent = { part: 'recent', version: 2, recent };
    const buckets: SnapshotBuckets = { part: 'buckets', version: 2, recallBuckets };
    expect(assembleSnapshot(part, recentPart, buckets)).toEqual({
      ...emptySnapshot(),
      settings: settingsAt(3),
    });
  });
});

describe('settingsAfter', () => {
  it('replaces a document that has not changed since the batch with the server one', () => {
    expect(settingsAfter(settingsAt(100), 100, 100, settingsAt(500))).toEqual({
      replace: settingsAt(500),
      syncedAt: 500,
    });
  });

  it('keeps a document that changed after the batch was built', () => {
    expect(settingsAfter(settingsAt(300), 0, 100, settingsAt(100))).toEqual({
      replace: null,
      syncedAt: 100,
    });
  });

  it('does not replace a document that equals the server one', () => {
    expect(settingsAfter(settingsAt(100), 0, 100, settingsAt(100))).toEqual({
      replace: null,
      syncedAt: 100,
    });
  });

  it('takes the account settings when the guest has none', () => {
    expect(settingsAfter(null, 0, null, settingsAt(40))).toEqual({
      replace: settingsAt(40),
      syncedAt: 40,
    });
  });

  it('keeps unsent local settings when a snapshot is read and the batch carried none', () => {
    expect(settingsAfter(settingsAt(300), 100, null, settingsAt(200))).toEqual({
      replace: null,
      syncedAt: 100,
    });
  });

  it('leaves everything when the server has no settings', () => {
    expect(settingsAfter(settingsAt(100), 100, null, null)).toEqual({
      replace: null,
      syncedAt: 100,
    });
  });
});
