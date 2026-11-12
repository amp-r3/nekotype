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

export type ValidTestConfig =
  | { readonly kind: 'time'; readonly seconds: 15 | 30 | 60 | 120 }
  | { readonly kind: 'count'; readonly prompts: 10 | 25 | 50 | 100 }
  // No length: the test goes on until it is ended by hand (spec metrics.md, "Test end").
  | { readonly kind: 'zen' };

export type ValidSettings = {
  readonly typing: {
    readonly script: 'hiragana' | 'katakana' | 'both';
    readonly content: 'words' | 'phrases';
    readonly strictness: 'learner' | 'ime';
    readonly weakFocus: boolean;
    readonly test: ValidTestConfig;
    readonly showTranslation: boolean;
  };
  readonly learn: {
    readonly strictness: 'learner' | 'ime';
    readonly track: 'hiragana' | 'katakana';
    // Target answer time of confidence: 1000–3000 in steps of 250.
    readonly targetMs: number;
    readonly sound: boolean;
  };
  readonly updatedAt: number;
};

// Learning (spec metrics.md, "Data model")

export type Mode = 'typing' | 'learn';
export type Track = 'hiragana' | 'katakana';
export type LearnKanaKey = `${Track}:${string}`;

export type RecallAnswer = {
  /** Time of the answer, Unix ms; identifies the answer in a merge. */
  readonly at: number;
  /** Answer time, ms. */
  readonly ms: number;
  /** No error. */
  readonly ok: boolean;
};

export type LearnBox = 0 | 1 | 2 | 3 | 4 | 5;

export type LearnEntry = {
  readonly box: LearnBox;
  /** 0 in box 0. */
  readonly dueAt: number;
  readonly updatedAt: number;
};

export type LearnStat = {
  readonly recognitions: number;
  readonly recognitionErrors: number;
  /** Kana chosen instead of this one → count. */
  readonly mixups: Readonly<Record<LearnKanaKey, number>>;
};

export type LearnState = {
  /** In track order; starts with the vowels. */
  readonly unlocked: Readonly<Record<Track, readonly LearnKanaKey[]>>;
  /** Introduced kana. */
  readonly entries: Readonly<Record<LearnKanaKey, LearnEntry>>;
  /** The last 10 recall answers, oldest first. */
  readonly recent: Readonly<Record<LearnKanaKey, readonly RecallAnswer[]>>;
  readonly stats: Readonly<Record<LearnKanaKey, LearnStat>>;
  /** Runs of consecutive active local days `[first, last]`; ascending, never overlapping or adjacent. */
  readonly activeDays: readonly (readonly [first: number, last: number])[];
  /** Recall answer times per track and local day, counted in buckets of 100 ms. */
  readonly recallBuckets: Readonly<Record<Track, DayBuckets>>;
};

/** Local day → bucket → number of recall answers. */
export type DayBuckets = Readonly<Record<string, Readonly<Record<string, number>>>>;

export type Counters = {
  readonly started: Readonly<Record<Mode, number>>;
  readonly finished: Readonly<Record<Mode, number>>;
};

// Typing (spec metrics.md, "Data model")

/** The key of a kana in the statistics, as in the engine's kana table. */
export type KanaKey = LearnKanaKey;

export type KanaStat = {
  /** Committed tokens of this kana in saved typing tests. */
  readonly attempts: number;
  /** Of which errored. */
  readonly erroredAttempts: number;
};

export type TestEndReason = 'complete' | 'manual' | 'idle' | 'hidden';

export type TestResult = {
  /** UUID v7, generated on the client. */
  readonly id: string;
  readonly content: 'words' | 'phrases';
  readonly script: 'hiragana' | 'katakana' | 'both';
  readonly strictness: 'learner' | 'ime';
  readonly config:
    | { readonly kind: 'time'; readonly seconds: number }
    | { readonly kind: 'count'; readonly prompts: number }
    | { readonly kind: 'zen' };
  readonly endReason: TestEndReason;
  /** Started with "Repeat". */
  readonly repeated: boolean;
  readonly startedAt: number;
  readonly endedAt: number;
  readonly durationMs: number;
  readonly tokens: number;
  readonly erroredTokens: number;
  /** Completed prompts. */
  readonly items: number;
  readonly keystrokes: number;
  readonly rejectedKeystrokes: number;
  /** Hints (Esc). */
  readonly assisted: number;
  /** Stored rounded to 0.1. */
  readonly kpm: number;
  /** A fraction 0–1, stored rounded to 4 decimals. */
  readonly kanaAccuracy: number;
  /** A personal best was shown on this device at completion. */
  readonly celebratedPersonalBest: boolean;
  readonly contentVersion: string;
  readonly appVersion: string;
};

export type TypingRecordEntry = {
  /** Null until a result is eligible. */
  readonly best: { readonly kpm: number; readonly resultId: string } | null;
  /** The last 10 results counted in the average, oldest first. */
  readonly recent: readonly {
    readonly resultId: string;
    readonly endedAt: number;
    readonly kpm: number;
  }[];
};

/** Key: `personalBestKey()`. */
export type TypingRecords = Readonly<Record<string, TypingRecordEntry>>;
