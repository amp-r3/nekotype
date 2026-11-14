export type { KanaStatMap } from './model/types';

export { computeWeakness, computeWeight, computeWeights, computeItemWeight } from './lib/weights';

export { modeLabel, modeLine } from './lib/mode-line';
export type { ModeParts } from './lib/mode-line';

export type {
  TypingStore,
  TypingStatus,
  SaveTestInput,
  SavedTest,
  TypingStoreDeps,
} from './model/store';
export {
  createTypingStore,
  typingKanaStats,
  typingCounters,
  typingRecords,
  typingStatus,
  initTyping,
  saveTest,
  recordDiscardedTest,
  resetTyping,
  retryTyping,
  readAllResults,
} from './model/store';
