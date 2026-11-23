import { outboxDelta } from '@nekotype/shared/runtime';
import type { Db, Read, Write } from './idb';

export const SNAPSHOT_STORE = 'snapshot';
export const OUTBOX_STORE = 'outbox';
export const SYNC_KEY = 'current';
export const DELTA_STORE = 'delta';
export const META_STORE = 'meta';
export const LOG_STORE = 'log';

/**
 * What a store reads to build its view besides its own delta (p5-plan.md, D18). Each store checks
 * only the part it reads, so a broken part it does not read cannot hide its own, and the guards of
 * the whole snapshot stay out of the first screen's chunk (ADR 087).
 */
export type SyncBase = {
  /** The server's snapshot, unchecked; `undefined` for a guest. */
  readonly snapshot: unknown;
  /** The delta of the batch awaiting acknowledgement, unchecked; null when there is none. */
  readonly outbox: Readonly<Record<string, unknown>> | null;
};

const SYNC_READS: readonly Read[] = [
  { store: SNAPSHOT_STORE, key: SYNC_KEY },
  { store: OUTBOX_STORE, key: SYNC_KEY },
];

/**
 * Reads the snapshot, the outbox and `extra` in one transaction, so that an acknowledgement (which
 * moves a batch from the outbox into the snapshot in one transaction) is seen whole or not at all.
 * A part that fails the reading store's validation counts as absent (ADR 061).
 */
export async function readWithSyncBase(
  db: Db,
  extra: readonly Read[],
): Promise<{ base: SyncBase; values: readonly unknown[] }> {
  let read: readonly unknown[] = [];
  await db.update([...SYNC_READS, ...extra], (values) => {
    read = values;
    return [] satisfies Write[];
  });
  const [snapshot, outbox, ...values] = read;
  return {
    base: { snapshot, outbox: outboxDelta(outbox) },
    values,
  };
}
