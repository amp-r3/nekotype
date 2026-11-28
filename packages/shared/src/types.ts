// Types shared by the client and the server. No runtime code.

export interface Clock {
  now(): number;
}

export interface Rng {
  next(): number;
}

export type TimeoutHandle = {
  readonly id: number | ReturnType<typeof setTimeout>;
};

export interface Scheduler {
  setTimeout(fn: () => void, ms: number): TimeoutHandle;
  clearTimeout(handle: TimeoutHandle): void;
  setInterval(fn: () => void, ms: number): TimeoutHandle;
  clearInterval(handle: TimeoutHandle): void;
}

/** Plays the sound of a kana; a provider that plays nothing stands in until P6 (learning.md, "Audio"). */
export interface AudioProvider {
  /** Never throws and never waits: a sound that fails is skipped. */
  play(key: LearnKanaKey): void;
}

export type ValidSettings = {
  readonly learn: {
    readonly strictness: 'learner' | 'ime';
    readonly track: 'hiragana' | 'katakana';
    readonly sound: boolean;
  };
  readonly updatedAt: number;
};

// Learning (spec metrics.md, "Data model")

export type Track = 'hiragana' | 'katakana';
export type LearnKanaKey = `${Track}:${string}`;

// The learning log (ADR 100, point 7; P7 plan D2). The model folds it; nothing here is a state.

export type TaskKind =
  | 'recall' // shape → romaji
  | 'recognition' // sound (romaji in P7) → one of 4 shapes
  | 'contrast' // which of a confusable pair (P9)
  | 'transfer' // か → カ (P9)
  | 'build' // か + ゛ → が (P9)
  | 'fluency' // one kana typed in a fluency run (P9)
  | 'listening' // sound → shape (P10)
  | 'dictation' // sound → romaji (P10)
  | 'pair' // minimal pair か or が (P10)
  | 'word' // a word (P9, ADR 116)
  | 'mismatch' // find the error: the kana shown under another kana's romaji (P9)
  | 'script'; // hiragana or katakana? (P9)

/** A word item of P12: `word:` and its reading in kana. */
export type WordKey = `word:${string}`;

/** Identity and order of an event (ADR 100, point 7). */
export type EventId = {
  /** Device clock, Unix ms, integer; never lower than the device's previous event. */
  readonly at: number;
  /** The log device id: a UUID created with the log on the device. */
  readonly dev: string;
  /** 1, 2, 3, … per `dev`. */
  readonly n: number;
};

/** A rule of P9 (ADR 117, point 3): っ doubles the next consonant, ー lengthens the vowel. */
export type RuleKey = 'rule:sokuon' | 'rule:choon';

export type IntroductionEvent = EventId & {
  readonly t: 'intro';
  readonly k: LearnKanaKey | RuleKey;
};

export type AnswerEvent = EventId & {
  readonly t: 'answer';
  readonly task: TaskKind;
  /**
   * The kana asked: the composite of `build`, the katakana of `transfer`, the odd kana of
   * `mismatch`. A `RuleKey` only for a rule token of a word; a `WordKey` only for a word item (P13).
   */
  readonly k: LearnKanaKey | WordKey | RuleKey;
  /** Typed: no rejected key and no reveal on it. A choice: the right one. */
  readonly ok: boolean;
  /** Answer time, integer ms, 0–10,000 (recall: A37; other tasks: showing the task → the answer). */
  readonly ms: number;
  /** The answer was revealed before it was typed (Esc, "show the romaji"). */
  readonly hint: boolean;
  /** The wrong answer given: the option chosen, or the kana the typed romaji matched (D18). */
  readonly wrong: LearnKanaKey | null;
  /**
   * The other option of a two-option task (`contrast`, `pair`) or the kana whose romaji
   * `mismatch` showed; null otherwise.
   */
  readonly alt: LearnKanaKey | null;
  /** Keys rejected on it, 0–9 (more count as 9); 0 for a choice. A rule's: its rule errors. */
  readonly misses: number;
  /** The reading of the word the event belongs to; null outside a word task. */
  readonly w: string | null;
};

/** `tz`: the device's UTC offset at the start, in minutes east of UTC (−720…840). */
export type SessionStartEvent = EventId & { readonly t: 'start'; readonly tz: number };
export type SessionEndEvent = EventId & { readonly t: 'end' };

export type LogEvent = IntroductionEvent | AnswerEvent | SessionStartEvent | SessionEndEvent;

/** An event before the log gave it its identity (D16). */
export type EventDraft =
  | Omit<IntroductionEvent, 'dev' | 'n'>
  | Omit<AnswerEvent, 'dev' | 'n'>
  | Omit<SessionStartEvent, 'dev' | 'n'>
  | Omit<SessionEndEvent, 'dev' | 'n'>;

// The log as it travels and is stored (P7 plan, D11): one page is a sync batch, a D1 row and an
// IndexedDB record.

/**
 * An answer in 9, 10 or 11 fields: `misses` and `w` are left out at their end when they are 0 and
 * null, so a page of format 3 is a page of format 4.
 */
export type EncodedAnswer =
  | readonly [...AnswerFields]
  | readonly [...AnswerFields, misses: number]
  | readonly [...AnswerFields, misses: number, w: string];

type AnswerFields = [
  dt: number,
  t: 'a',
  task: TaskKind,
  k: LearnKanaKey | WordKey | RuleKey,
  ok: 0 | 1,
  ms: number,
  hint: 0 | 1,
  wrong: LearnKanaKey | '',
  alt: LearnKanaKey | '',
];

/** `dt`: `at` minus the previous event's `at` in the page (0 for the first); '' stands for null. */
export type EncodedEvent =
  | readonly [dt: number, t: 'i', k: LearnKanaKey | RuleKey]
  | EncodedAnswer
  | readonly [dt: number, t: 's', tz: number]
  | readonly [dt: number, t: 'e'];

export type LogPage = {
  readonly dev: string;
  /** `n` of the first event; the others follow without gaps. */
  readonly n0: number;
  /** `at` of the first event. */
  readonly at0: number;
  readonly e: readonly EncodedEvent[];
};

// Sync batches (spec backend.md, "Request and response bodies")

/** Sync format 4 (P9 plan, D3): the log as batches. */
export type SyncRequest = {
  readonly v: 4;
  readonly deviceId: string;
  readonly seq: number;
  /** The highest row id the device has pulled (`meta.pulledId`). */
  readonly after: number;
  /** The own events not acknowledged yet, or null. */
  readonly log: LogPage | null;
  readonly settings: ValidSettings | null;
};
/** `POST /api/sync`: the last applied `seq`, and whether other devices wrote rows after `after`. */
export type SyncResponse = { readonly lastSeq: number; readonly more: boolean };
export type PulledRow = { readonly id: number; readonly log: LogPage };
/** `GET /api/sync?deviceId=&after=`: rows of other devices after `after`. */
export type PullResponse = {
  /** The highest id the page examined, own rows included: the next `after`. */
  readonly last: number;
  /** Rows after `last` exist. */
  readonly more: boolean;
  readonly settings: ValidSettings | null;
  readonly rows: readonly PulledRow[];
};

export type MeResponse = {
  readonly id: string;
  readonly email: string | null;
  readonly displayName: string | null;
  readonly avatarUrl: string | null;
};

export type ReportRequest = {
  readonly itemId: string;
  readonly contentVersion: string;
  readonly reason: 'wrong_reading' | 'wrong_translation' | 'other';
  /** At most 500 characters. */
  readonly comment?: string;
  readonly turnstileToken: string;
};

/** The error table of backend.md (with `not_found` and `internal`, p5-plan.md S3). */
export type ApiErrorCode =
  | 'invalid_body'
  | 'unauthenticated'
  | 'bad_origin'
  | 'turnstile_failed'
  | 'not_found'
  | 'seq_gap'
  | 'too_large'
  | 'rate_limited'
  | 'internal'
  | 'conflict'
  | 'unavailable';
