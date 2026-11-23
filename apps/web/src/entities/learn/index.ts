export type {
  Counters,
  LearnBox,
  LearnEntry,
  LearnKanaKey,
  LearnState,
  LearnStat,
  RecallAnswer,
  Track,
} from '@nekotype/shared/types';

export type { Keystroke } from './lib/answer-time';
export {
  ANSWER_TIME_CAP_MS,
  DEFAULT_K_MS,
  intervalsOf,
  median,
  recallAnswerTime,
  answerK,
} from './lib/answer-time';

export { CONFIDENT_ACCURACY, accuracyOf, isConfident, medianAnswerMs } from './lib/confidence';
export { dependenciesOf, keyOf, keysOfTrack, nextUnlock, trackOfKey } from './lib/tracks';
export {
  TRACKS,
  evaluateBoxes,
  evaluateUnlocking,
  initialCounters,
  initialLearnState,
} from './lib/state';
export { dayStart, localDay } from './lib/day';
export {
  BOX_DAYS,
  MASTERED_BOX,
  dueAtFor,
  isDue,
  isDueKana,
  isMastered,
  nextBox,
  reviewEntry,
  settleEntry,
} from './lib/boxes';
export { addActiveDay, bestStreak, currentStreak } from './lib/streak';

export type { AnswerInput, LearnStatus, LearnStore, LearnStoreDeps } from './model/learn-store';
export {
  createLearnStore,
  flushLearning,
  endSession,
  initLearn,
  introduce,
  learnReady,
  learnStatus,
  learnView,
  modelState,
  recordAnswer,
  reloadLearning,
  resetLearning,
  retryLearn,
  startSession,
} from './model/learn-store';

// The old store: it still serves the sync and the reset until PR 11 (P7 plan, D21).
export {
  legacyInitLearn,
  legacyIntroduce,
  legacyLearnState,
  legacyResetLearning,
} from './model/store';

export type { CellState, ChartRowInfo, KanaCellInfo } from './lib/chart';
export { cellInfos, chartRows } from './lib/chart';

export { bestStreakOfDays, dueCount, streakOfDays, streaks } from './lib/progress';
