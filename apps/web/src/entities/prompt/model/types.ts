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
  // `mixed` (kana with katakana words in one sentence) is for phrases only.
  readonly script: Script | 'mixed';
  readonly meaning: { readonly en: string };
  readonly readingHints?: readonly ReadingHint[];
  readonly tatoebaId?: number;
};
