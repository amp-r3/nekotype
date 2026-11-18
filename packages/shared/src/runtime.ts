// Re-exports only. A barrel with code of its own sits in the initial chunk, and so does every module
// it re-exports, with each export any lazy chunk uses (apps/web/vite.config.ts).
export { isTestConfig, isSettings } from './settings-runtime';
export { isObject } from './object';

// The learning state's guards and merge rules are a module of their own: the first screen does not
// need them, so they stay out of the chunk it shares with the lazy screens.
export {
  RECENT_ANSWERS,
  isLearnKanaKey,
  isRecallAnswer,
  isLearnEntry,
  isLearnStat,
  isActiveDays,
  isLearnRest,
  isRecentMap,
  isRecallBuckets,
  isLearnState,
  isCounters,
  mergeUnlocked,
  mergeRecent,
  mergeEntry,
  mergeEntries,
  addCounters,
  addLearnStats,
  mergeActiveDays,
  BUCKET_MS,
  MAX_BUCKET,
  BUCKET_DAYS,
  bucketOf,
  dropOldDays,
  addBuckets,
  RECOGNITION_DECAY_AT,
  decayLearnStat,
} from './learn-runtime';
export { touchedKeys, patchRecent, patchBuckets, splitLearnDelta } from './learn-patch';
export type { BucketsPatch, TouchedKeys } from './learn-patch';
export { emptyLearnState, mergeLearn, patchLearn } from './learn-state';
export type { LearnPatch, StatPatch, StoredLearn } from './learn-state';
export { SYNC_FORMAT_VERSION, outboxDelta } from './sync-format';
export {
  MAX_RESULTS_PER_BATCH,
  MAX_SYNC_BODY_BYTES,
  BATCH_CAPS,
  isSyncResponse,
  isSnapshotRest,
  isSnapshotRecent,
  isSnapshotBuckets,
  isSnapshot,
  isOutbox,
  mergeSettings,
  applyBatch,
} from './sync-runtime';

// Typing records, kana statistics and test results: rules shared with the server.
export {
  RECENT_RESULTS,
  BEST_MIN_ACCURACY,
  KANA_DECAY_AT,
  roundKpm,
  roundAccuracy,
  personalBestKey,
  isBestEligible,
  averageKpm,
  applyResultToRecords,
  applyResultsToRecords,
  mergeTypingRecords,
  mergeKanaStats,
  isKanaStats,
  addKanaStats,
  decayKanaStat,
  isKanaStat,
  isTestResult,
  isTypingRecordEntry,
  isTypingRecords,
} from './typing-runtime';
export type { ResultApplied } from './typing-runtime';
