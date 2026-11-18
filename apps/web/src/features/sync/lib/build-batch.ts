import type {
  Counters,
  KanaStat,
  LearnDelta,
  SyncRequest,
  TestResult,
  ValidSettings,
} from '@nekotype/shared/types';
import {
  BATCH_CAPS,
  MAX_RESULTS_PER_BATCH,
  SYNC_FORMAT_VERSION,
  addCounters,
  emptyLearnState,
  splitLearnDelta,
} from '@nekotype/shared/runtime';

/** What a store keeps in `delta/learn`: the learning changes and the counters since the last batch. */
export type LearnChanges = { readonly learn: LearnDelta; readonly counters: Counters };
/** `delta/typing`. */
export type TypingChanges = {
  readonly kanaStats: Readonly<Record<string, KanaStat>>;
  readonly counters: Counters;
};

export const noCounters = (): Counters => ({
  started: { typing: 0, learn: 0 },
  finished: { typing: 0, learn: 0 },
});

export const noLearnChanges = (): LearnChanges => ({
  learn: emptyLearnState(),
  counters: noCounters(),
});

const sum = (c: Counters): number =>
  c.started.typing + c.started.learn + c.finished.typing + c.finished.learn;

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

export const isEmptyTypingChanges = (changes: TypingChanges): boolean =>
  Object.keys(changes.kanaStats).length === 0 && sum(changes.counters) === 0;

export type BatchInput = {
  readonly deviceId: string;
  readonly seq: number;
  readonly learn: LearnChanges;
  readonly typing: TypingChanges;
  /** The settings to carry: the document when it changed since the server last had it, else null. */
  readonly settings: ValidSettings | null;
  /** Unsynced results, oldest first. */
  readonly results: readonly TestResult[];
};

export type Batch = {
  readonly request: SyncRequest;
  /** The ids of the results the batch carries. */
  readonly resultIds: readonly string[];
  /** What the batch left out because of the caps: it stays in `delta/learn`. */
  readonly rest: LearnChanges;
};

export const bodyBytes = (text: string): number => new TextEncoder().encode(text).length;

/**
 * Builds the next batch (storage-sync.md, "Batches", step 3): both deltas, the settings, up to 50
 * results, the learning part capped (`splitLearnDelta`) and the whole within `maxBytes`. Results are
 * dropped from the end until it fits. Null when there is nothing to send, or when the delta alone
 * does not fit.
 */
export function buildBatch(input: BatchInput, maxBytes: number): Batch | null {
  const { head, rest } = splitLearnDelta(input.learn.learn, BATCH_CAPS);
  const delta = {
    kanaStats: input.typing.kanaStats,
    counters: addCounters(input.learn.counters, input.typing.counters),
    learn: head,
    settings: input.settings,
  };
  let results = input.results.slice(0, MAX_RESULTS_PER_BATCH);
  const request = (): SyncRequest => ({
    v: SYNC_FORMAT_VERSION,
    deviceId: input.deviceId,
    seq: input.seq,
    delta,
    results,
  });
  const nothing =
    isEmptyLearn(head) &&
    isEmptyTypingChanges({ kanaStats: delta.kanaStats, counters: delta.counters }) &&
    delta.settings === null &&
    results.length === 0;
  if (nothing) return null;
  while (bodyBytes(JSON.stringify(request())) > maxBytes) {
    if (results.length === 0) return null;
    results = results.slice(0, results.length - 1);
  }
  return {
    request: request(),
    resultIds: results.map((r) => r.id),
    rest: { learn: rest, counters: noCounters() },
  };
}
