// The bodies `measure.ts` sends to `POST /api/sync` (p5-plan.md, PR 1, PR 5 and PR 13).
import { KANA_KEYS, generateBatch } from '@nekotype/shared/testing';
import type { SyncRequestV2 } from '@nekotype/shared/types';
import { benchSettings } from './seed';

/** The batches of D14 that remain after P6: a learning sync, the caps, and a learning sync with settings. */
export type Batch = 'learning' | 'capped' | 'finished';

/** The body of one request. */
export function batchBody(batch: Batch, seq: number): SyncRequestV2 {
  const learning = generateBatch({
    seed: 3,
    keys: KANA_KEYS,
    kind: batch === 'capped' ? 'capped' : 'learning',
  });
  if (batch === 'finished') {
    // One finished learning session with the settings it ran with.
    return { ...learning, seq, delta: { ...learning.delta, settings: benchSettings(Date.now()) } };
  }
  return { ...learning, seq };
}
