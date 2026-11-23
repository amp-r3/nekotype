import type { LogEvent, SyncRequest, ValidSettings } from '@nekotype/shared/types';
import { MAX_PAGE_EVENTS, SYNC_FORMAT_VERSION, encodePage } from '@nekotype/shared/runtime';

export type BatchInput = {
  readonly deviceId: string;
  readonly seq: number;
  /** `meta.pulledId`: the highest server row the device has pulled. */
  readonly after: number;
  /** The own events not acknowledged yet, in order of `n` (`readUnsent`). */
  readonly unsent: readonly LogEvent[];
  /** `meta.sentN + 1`: the `n` the batch must start at. */
  readonly firstN: number;
  /** The settings to carry: the document when it changed since the server last had it, else null. */
  readonly settings: ValidSettings | null;
};

export type Batch = {
  readonly request: SyncRequest;
  /** The `n` of the last event the batch carries; null when it carries none. */
  readonly lastN: number | null;
};

export const bodyBytes = (text: string): number => new TextEncoder().encode(text).length;

/**
 * Builds the next batch (storage-sync.md, "Batches", step 3): the longest prefix of the unsent own
 * events whose request fits `maxBytes`, found by halving, and the settings. Null when there is
 * nothing to send, or when not even the settings fit.
 */
export function buildBatch(input: BatchInput, maxBytes: number): Batch | null {
  // Only the run that starts exactly at `firstN`: `readUnsent` reads the pages one by one, so a
  // page closed between two reads could hide the first events, and a gap would be marked as sent.
  let run = 0;
  while (input.unsent[run]?.n === input.firstN + run) run += 1;
  const unsent = input.unsent.slice(0, run);
  const request = (count: number): SyncRequest => ({
    v: SYNC_FORMAT_VERSION,
    deviceId: input.deviceId,
    seq: input.seq,
    after: input.after,
    log: count === 0 ? null : encodePage(unsent.slice(0, count)),
    settings: input.settings,
  });
  const fits = (count: number): boolean => bodyBytes(JSON.stringify(request(count))) <= maxBytes;

  let low = 0;
  let high = Math.min(unsent.length, MAX_PAGE_EVENTS);
  if (!fits(0)) return null;
  // Invariant: `low` fits; the answer is in [low, high].
  while (low < high) {
    const mid = Math.ceil((low + high) / 2);
    if (fits(mid)) low = mid;
    else high = mid - 1;
  }
  if (low === 0 && input.settings === null) return null;
  const last = unsent[low - 1];
  return { request: request(low), lastN: last === undefined ? null : last.n };
}
