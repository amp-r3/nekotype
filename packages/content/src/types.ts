import type { ReadingHint } from '@nekotype/engine';

export type ContentScript = 'hiragana' | 'katakana' | 'mixed';

/** A word or phrase of the generated chunks (docs/spec/content.md, "Output"). */
export interface ContentItem {
  /** `w:<script>:<reading>` for a word, `p:<tatoeba sentence id>` for a phrase. */
  id: string;
  text: string;
  script: ContentScript;
  meaning: { en: string };
  readingHints?: ReadingHint[];
  tatoebaId?: number;
}

export interface SelectionReport {
  source: 'jlpt' | 'fallback';
  /** Items that passed the selection filters (before the compile check). */
  selected: number;
  excluded: Record<string, number>;
  compileFailed: { id: string; text: string }[];
}

/** The credit of a phrase (docs/spec/content.md, "Output"). */
export interface PhraseCredit {
  id: string;
  /** The kana of the phrase, so `/about` loads this one chunk (A2). */
  text: string;
  sentence: { id: number; author: string };
  translation: { id: number; author: string };
  /** `null`: machine-generated, verified by kuromoji. */
  transcriptionAuthor: string | null;
}
