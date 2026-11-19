// The bodies `measure.ts` sends to `POST /api/sync` (p5-plan.md, PR 1, PR 5 and PR 13).
import { KANA_KEYS, generateBatch } from '@nekotype/shared/testing';
import type { SyncRequest } from '@nekotype/shared/types';
import { benchSettings } from './seed';

/** The batches of D14, one finished test (acceptance 12) and the largest batch allowed (18). */
export type Batch = 'learning' | 'capped' | 'results' | 'finished' | 'largest';

/**
 * The body of one request. Results take their ids from a seed that changes with `seq`, so every
 * request inserts new rows instead of meeting the ids of the one before (PR 5 sent the same 50).
 */
export function batchBody(batch: Batch, seq: number): SyncRequest {
  const results = generateBatch({ seed: seq, keys: KANA_KEYS, kind: 'results' });
  if (batch === 'results') return { ...results, seq };
  if (batch === 'finished') {
    // One test of 60 seconds: a few kana, the typing counters, the settings it ran with.
    return {
      ...results,
      seq,
      delta: {
        ...results.delta,
        kanaStats: Object.fromEntries(Object.entries(results.delta.kanaStats).slice(0, 20)),
        counters: {
          ...results.delta.counters,
          started: { typing: 1, learn: 0 },
          finished: { typing: 1, learn: 0 },
        },
        settings: benchSettings(Date.now()),
      },
      results: results.results.slice(0, 1),
    };
  }
  const learn = generateBatch({
    seed: 3,
    keys: KANA_KEYS,
    kind: batch === 'largest' ? 'capped' : batch,
  });
  if (batch !== 'largest') return { ...learn, seq };
  // The caps of the learning delta and the 50 results of one batch together.
  return {
    ...learn,
    seq,
    delta: { ...learn.delta, kanaStats: results.delta.kanaStats },
    results: results.results,
  };
}
