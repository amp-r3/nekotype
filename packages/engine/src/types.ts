export type RowCategory = 'basic' | 'dakuten' | 'yoon' | 'extended';

export type BasicRowId = 'vowels' | 'k' | 's' | 't' | 'n' | 'h' | 'm' | 'y' | 'r' | 'w_n';

export type DakutenRowId = 'g' | 'z' | 'd' | 'b' | 'p';

export type YoonRowId = 'ky' | 'sh' | 'ch' | 'ny' | 'hy' | 'my' | 'ry' | 'gy' | 'j' | 'by' | 'py';

export type ExtendedRowId = 'ext_fa' | 'ext_va' | 'ext_wi' | 'ext_ti' | 'ext_che';

export type RowId = BasicRowId | DakutenRowId | YoonRowId | ExtendedRowId;

export type Script = 'hiragana' | 'katakana';
export type KanaKey = `${Script}:${string}`;

export type KanaEntry = {
  readonly hiragana?: string;
  readonly katakana: string;
  readonly ime: readonly string[];
  readonly learner: readonly string[];
};

export type KanaRow = {
  readonly id: RowId;
  readonly name: string;
  readonly category: RowCategory;
  readonly entries: readonly KanaEntry[];
};

export type KanaTable = readonly KanaRow[];

// Kana typed as standalone tokens (small kana, ゐ, ゑ). Not selectable rows: `RowId` is unchanged.
export type StandaloneRowId = 'small' | 'archaic';

export type StandaloneRow = {
  readonly id: StandaloneRowId;
  readonly entries: readonly KanaEntry[];
};

// What the engine reads from a table: entries only. Both `KanaRow` and `StandaloneRow` fit.
export type EngineTable = readonly { readonly entries: readonly KanaEntry[] }[];

export type ReadingHint = {
  readonly tokenIndex: number;
  readonly learner: readonly string[];
};

export type PromptItem = {
  readonly key: string;
  readonly text: string;
  readonly script?: Script | 'mixed';
  readonly meaning?: { readonly en: string };
  readonly readingHints?: readonly ReadingHint[];
  // A phrase from Tatoeba: the sentence behind the "source" link.
  readonly tatoebaId?: number;
};

export type Strictness = 'learner' | 'ime';
