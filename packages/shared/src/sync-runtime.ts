import {
  addCounters,
  isCounters,
  isLearnRest,
  isLearnState,
  isRecallBuckets,
  isRecentMap,
} from './learn-runtime';
import { mergeLearn } from './learn-state';
import { isObject } from './object';
import { isSettings } from './settings-runtime';
import { isCount, outboxDelta } from './sync-format';
import type {
  Outbox,
  Snapshot,
  SnapshotBuckets,
  SnapshotRecent,
  SnapshotRest,
  SyncRequest,
  SyncResponse,
  ValidSettings,
} from './types';

// Constants and guards of the sync, and the one function that applies a batch to a snapshot
// (spec backend.md, "Applying a batch"; ADR 082).

/** The body of a sync request, bytes (backend.md, "Sync request limits"). */
export const MAX_SYNC_BODY_BYTES = 256 * 1024;
/** The caps on the learning part of a batch (p5-plan.md, Q1; ADR 082): kana, and days per track. */
export const BATCH_CAPS = { kana: 60, days: 31 } as const;

export function isSyncResponse(value: unknown): value is SyncResponse {
  return isObject(value) && isCount(value['lastSeq']) && isCount(value['version']);
}

function isSettingsOrNull(value: unknown): value is ValidSettings | null {
  return value === null || isSettings(value);
}

export function isSnapshotRest(value: unknown): value is SnapshotRest {
  return (
    isObject(value) &&
    value['part'] === 'rest' &&
    isCount(value['lastSeq']) &&
    isCount(value['version']) &&
    isSettingsOrNull(value['settings']) &&
    isCounters(value['counters']) &&
    isLearnRest(value['learn'])
  );
}

export function isSnapshotRecent(value: unknown): value is SnapshotRecent {
  return (
    isObject(value) &&
    value['part'] === 'recent' &&
    isCount(value['version']) &&
    isRecentMap(value['recent'])
  );
}

export function isSnapshotBuckets(value: unknown): value is SnapshotBuckets {
  return (
    isObject(value) &&
    value['part'] === 'buckets' &&
    isCount(value['version']) &&
    isRecallBuckets(value['recallBuckets'])
  );
}

export function isSnapshot(value: unknown): value is Snapshot {
  return (
    isObject(value) &&
    isSettingsOrNull(value['settings']) &&
    isCounters(value['counters']) &&
    isObject(value['learn']) &&
    isLearnRest(value['learn']) &&
    isRecentMap(value['learn']['recent']) &&
    isRecallBuckets(value['learn']['recallBuckets'])
  );
}

/** Settings: last write wins on `updatedAt`; the first batch of a sign-in (`seq` 1) yields to the account's. */
export function mergeSettings(
  stored: ValidSettings | null,
  incoming: ValidSettings | null,
  seq: number,
): ValidSettings | null {
  if (incoming === null) return stored;
  if (stored === null) return incoming;
  if (seq === 1) return stored;
  return incoming.updatedAt > stored.updatedAt ? incoming : stored;
}

/**
 * Applies a batch to a snapshot by the server's rules. The server applies them to the touched keys
 * of the stored columns and the client calls this on an acknowledgement whose `version` is the
 * stored one plus 1; a property test keeps the two equal.
 */
export function applyBatch(snapshot: Snapshot, request: SyncRequest): Snapshot {
  const { delta } = request;
  return {
    settings: mergeSettings(snapshot.settings, delta.settings, request.seq),
    counters: addCounters(snapshot.counters, delta.counters),
    learn: mergeLearn(snapshot.learn, delta.learn),
  };
}

/**
 * A stored batch, checked for what the stores read from it: the counters and the learning part of
 * its delta. The sync engine, which sends it, checks the settings when it reads it.
 */
export function isOutbox(value: unknown): value is Outbox {
  const delta = outboxDelta(value);
  return delta !== null && isCounters(delta['counters']) && isLearnState(delta['learn']);
}
