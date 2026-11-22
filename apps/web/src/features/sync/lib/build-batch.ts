import type { Counters, LearnDelta, SyncRequestV2, ValidSettings } from '@nekotype/shared/types';
import {
  BATCH_CAPS,
  SYNC_FORMAT_V2,
  emptyLearnState,
  splitLearnDelta,
} from '@nekotype/shared/runtime';

/** What a store keeps in `delta/learn`: the learning changes and the counters since the last batch. */
export type LearnChanges = { readonly learn: LearnDelta; readonly counters: Counters };

export const noCounters = (): Counters => ({ started: 0, finished: 0 });

export const noLearnChanges = (): LearnChanges => ({
  learn: emptyLearnState(),
  counters: noCounters(),
});

const sum = (c: Counters): number => c.started + c.finished;

const isEmptyDays = (days: LearnDelta['recallBuckets']): boolean =>
  Object.keys(days.hiragana).length === 0 && Object.keys(days.katakana).length === 0;

/** True when the learning changes hold nothing (the counters apart). */
export function isEmptyLearn(delta: LearnDelta): boolean {
  return (
    Object.keys(delta.entries).length === 0 &&
    Object.keys(delta.recent).length === 0 &&
    Object.keys(delta.stats).length === 0 &&
    delta.unlocked.hiragana.length === 0 &&
    delta.unlocked.katakana.length === 0 &&
    delta.activeDays.length === 0 &&
    isEmptyDays(delta.recallBuckets)
  );
}

export const isEmptyLearnChanges = (changes: LearnChanges): boolean =>
  isEmptyLearn(changes.learn) && sum(changes.counters) === 0;

export type BatchInput = {
  readonly deviceId: string;
  readonly seq: number;
  readonly learn: LearnChanges;
  /** The settings to carry: the document when it changed since the server last had it, else null. */
  readonly settings: ValidSettings | null;
};

export type Batch = {
  readonly request: SyncRequestV2;
  /** What the batch left out because of the caps: it stays in `delta/learn`. */
  readonly rest: LearnChanges;
};

export const bodyBytes = (text: string): number => new TextEncoder().encode(text).length;

/**
 * Builds the next batch (storage-sync.md, "Batches", step 3): the counters, the learning delta capped
 * (`splitLearnDelta`) and the settings, the whole within `maxBytes`. Null when there is nothing to
 * send, or when the batch does not fit.
 */
export function buildBatch(input: BatchInput, maxBytes: number): Batch | null {
  const { head, rest } = splitLearnDelta(input.learn.learn, BATCH_CAPS);
  const request: SyncRequestV2 = {
    v: SYNC_FORMAT_V2,
    deviceId: input.deviceId,
    seq: input.seq,
    delta: { counters: input.learn.counters, learn: head, settings: input.settings },
  };
  const nothing = isEmptyLearn(head) && sum(input.learn.counters) === 0 && input.settings === null;
  if (nothing) return null;
  if (bodyBytes(JSON.stringify(request)) > maxBytes) return null;
  return { request, rest: { learn: rest, counters: noCounters() } };
}
