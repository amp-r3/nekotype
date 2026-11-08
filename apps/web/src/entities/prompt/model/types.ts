import type { ReadingHint, Script } from '@nekotype/engine';

export type {
  BasicRowId,
  DakutenRowId,
  ExtendedRowId,
  KanaEntry,
  KanaKey,
  KanaRow,
  PromptItem,
  ReadingHint,
  RowCategory,
  RowId,
  Script,
  Strictness,
  YoonRowId,
} from '@nekotype/engine';

export type ScriptMode = Script | 'both';

export type ContentKind = 'words' | 'phrases';

export type ContentItem = {
  readonly id: string;
  readonly text: string;
  readonly script: Script;
  readonly meaning: { readonly en: string; readonly ru: string };
  readonly readingHints?: readonly ReadingHint[];
};

// What the pool builder reads from the user's settings; the settings slice is not imported here.
export type PoolSettings = {
  readonly script: ScriptMode;
  readonly content: ContentKind;
};
