// The envelope of the sync format, apart from the guards of its content: the first screen reads
// the outbox through it without the guards of the events (ADR 087).

/** The version of the batch format of the log (`SyncRequest.v`; ADR 100, point 7; P9 plan, D3). */
export const SYNC_FORMAT_VERSION = 4;

export function isCount(value: unknown): value is number {
  return typeof value === 'number' && Number.isInteger(value) && value >= 0;
}
