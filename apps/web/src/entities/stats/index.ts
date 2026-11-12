export type { KanaStatMap } from './model/types';

export { computeWeakness, computeWeight, computeWeights, computeItemWeight } from './lib/weights';

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
} from './model/store';
