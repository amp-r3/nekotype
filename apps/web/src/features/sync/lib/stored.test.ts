import { describe, expect, it } from 'vitest';
import { emptyCounters, emptyCounters as counters, learnDelta, result } from '../model/test-util';
import { readLearnChanges, readOutbox, readResultRow, readTypingChanges } from './stored';

const outbox = () => ({
  seq: 1,
  request: {
    v: 1,
    deviceId: 'dev',
    seq: 1,
    delta: {
      kanaStats: {},
      counters: counters(),
      learn: learnDelta(),
      settings: null,
    },
    results: [result('a', 1)],
  },
  resultIds: ['a'],
});

describe('stored records', () => {
  it('reads the learning and typing deltas, or null', () => {
    expect(readLearnChanges({ learn: learnDelta(), counters: emptyCounters() })).not.toBeNull();
    expect(readLearnChanges({ learn: 1, counters: emptyCounters() })).toBeNull();
    expect(readTypingChanges({ kanaStats: {}, counters: emptyCounters() })).not.toBeNull();
    expect(readTypingChanges(undefined)).toBeNull();
  });

  it('reads a whole outbox and rejects one with a broken part', () => {
    expect(readOutbox(outbox())).not.toBeNull();
    expect(readOutbox({ ...outbox(), seq: 2 })).toBeNull();
    expect(readOutbox({ ...outbox(), resultIds: [1] })).toBeNull();
    const bad = outbox();
    bad.request.results = [{ ...result('a', 1), id: '' }];
    expect(readOutbox(bad)).toBeNull();
    expect(readOutbox(undefined)).toBeNull();
  });

  it('reads a results row and strips the sync flag', () => {
    const row = readResultRow({ ...result('a', 1), synced: 1 });
    expect(row?.synced).toBe(true);
    expect(row?.result).toEqual(result('a', 1));
    expect(readResultRow({ ...result('a', 1), synced: 0 })?.synced).toBe(false);
    expect(readResultRow({ id: 'x' })).toBeNull();
  });
});
