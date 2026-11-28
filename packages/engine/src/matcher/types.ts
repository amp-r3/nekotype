import type { KanaKey, Strictness } from '../types';

// 'kana' covers table entries and merged っX; 'sokuon' is a standalone っ.
export type TokenKind = 'kana' | 'sokuon' | 'n' | 'choonpu' | 'skip';

export type Spelling = {
  readonly text: string;
  // Spelling constraint: indices of the spellings of the immediately following token this
  // spelling may precede. null means any (and, at the end of the stream, nothing follows).
  readonly next: readonly number[] | null;
};

export type Token = {
  readonly glyph: string;
  readonly kanaKey: KanaKey | null;
  readonly kind: TokenKind;
  // A 'kana' token that is a merged っX; false for every other token.
  readonly sokuon: boolean;
  readonly promptIndex: number;
  readonly spellings: readonly Spelling[];
};

export type Matcher = {
  readonly tokens: readonly Token[];
  // Index in `tokens` of the first token of each prompt.
  readonly promptStarts: readonly number[];
  readonly strictness: Strictness;
};

// Completed tokens of one path through the stream, newest first. firstKey and lastKey are indices
// of accepted keystrokes in the whole session; compact() rebases token but never the keys.
export type PathNode = {
  readonly token: number;
  readonly firstKey: number;
  readonly lastKey: number;
  readonly prev: PathNode | null;
};

// A position inside a spelling of a token. offset === text.length means the token is done;
// the position then waits for the first key of the next token. token === -1 is the start, or the
// place of tokens dropped by compact().
export type Position = {
  readonly token: number;
  readonly spelling: number;
  readonly offset: number;
  readonly firstKey: number; // accepted keystroke that started the token
  readonly lastKey: number; // accepted keystroke that completed it, -1 while in progress
  readonly path: PathNode | null; // tokens completed before this one
};

export type MatchState = {
  readonly positions: readonly Position[];
  readonly keys: number; // accepted keystrokes so far; the next one has this index
};

export type EngineView = {
  readonly displayedTokens: number; // tokens completed by the display position
  readonly pendingLatin: string; // typed latin beyond those tokens
  readonly activeToken: number; // token highlighted in the stream, at most the token count
};

export type TokenTiming = {
  readonly tokenIndex: number;
  readonly firstKey: number;
  readonly lastKey: number;
};
