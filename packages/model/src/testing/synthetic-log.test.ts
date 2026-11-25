import { describe, expect, it } from 'vitest';
import { foldLog } from '../fold';
import { compareEvents } from '../order';
import { ITEMS } from '../items';
import { nextRow } from '../forecast';
import { syntheticLog } from './synthetic-log';

describe('syntheticLog', () => {
  it('is the same log for the same seed, a different one for another', () => {
    expect(syntheticLog({ answers: 500, seed: 3 })).toEqual(
      syntheticLog({ answers: 500, seed: 3 }),
    );
    expect(syntheticLog({ answers: 500, seed: 3 })).not.toEqual(
      syntheticLog({ answers: 500, seed: 4 }),
    );
  });

  it('has the answers asked for, in strict order, folding without a skip', () => {
    const events = syntheticLog({ answers: 2_000, seed: 1 });
    expect(events.filter((e) => e.t === 'answer')).toHaveLength(2_000);
    events.reduce((previous, e) => {
      expect(compareEvents(previous, e)).toBeLessThan(0);
      return e;
    });
    const fold = foldLog(events, { stats: true });
    expect(fold.ignored).toBe(0);
    expect(fold.stats?.started).toBe(fold.stats?.finished);
  });

  it('holds both tracks and a katakana row still to come at 40,000 answers', () => {
    const events = syntheticLog({ answers: 40_000, seed: 1 });
    const { state } = foldLog(events, { stats: false });
    const introduced = (track: string): number =>
      [...state.items.keys()].filter((key) => ITEMS.get(key)?.track === track).length;
    expect(introduced('hiragana')).toBe(104);
    expect(introduced('katakana')).toBeGreaterThanOrEqual(80);
    expect(nextRow(state, 'katakana')).not.toBeNull();
  });
});
