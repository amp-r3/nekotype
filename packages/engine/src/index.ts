export type {
  RowCategory,
  RowId,
  BasicRowId,
  DakutenRowId,
  YoonRowId,
  ExtendedRowId,
  Script,
  KanaKey,
  KanaEntry,
  KanaRow,
  KanaTable,
  EngineTable,
  StandaloneRow,
  StandaloneRowId,
  ReadingHint,
  PromptItem,
  Strictness,
} from './types';

export {
  basicRows,
  dakutenRows,
  yoonRows,
  extendedRows,
  standaloneRows,
  allKanaRows,
  engineTable,
  kanaOf,
  kanaRows,
  similarKana,
  similarPairs,
  SKIP_CHARACTERS,
  SOKUON_PREFIXES,
} from './data';

export type { TrackRow } from './data';

export { createEngine } from './matcher/engine';
export type { Engine } from './matcher/engine';
export { createErrorLog } from './matcher/error-log';
export type { ErrorLog } from './matcher/error-log';
export type {
  EngineView,
  TokenTiming,
  Spelling,
  Matcher,
  Position,
  MatchState,
  Token,
  TokenKind,
} from './matcher/types';
