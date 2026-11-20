import { describe, expect, it } from 'vitest';
import { emptyCounters, learnDelta } from '../model/test-util';
import { readLearnChanges, readOutbox } from './stored';

const outbox = () => ({
  seq: 1,
  request: {
    v: 2,
    deviceId: 'dev',
    seq: 1,
    delta: {
      counters: emptyCounters(),
      learn: learnDelta(),
      settings: null,
    },
  },
});

describe('stored records', () => {
  it('reads the learning delta, or null', () => {
    expect(readLearnChanges({ learn: learnDelta(), counters: emptyCounters() })).not.toBeNull();
    expect(readLearnChanges({ learn: 1, counters: emptyCounters() })).toBeNull();
    expect(readLearnChanges(undefined)).toBeNull();
  });

  it('reads a whole outbox and rejects one with a broken part', () => {
    expect(readOutbox(outbox())).not.toBeNull();
    expect(readOutbox({ ...outbox(), seq: 2 })).toBeNull();
    expect(readOutbox(undefined)).toBeNull();
  });

  it('rejects an outbox of format 1, with results and typing statistics', () => {
    const old = outbox();
    expect(readOutbox({ ...old, request: { ...old.request, v: 1 } })).toBeNull();
    expect(readOutbox({ ...old, request: { ...old.request, v: 1, results: [] } })).toBeNull();
  });
});
