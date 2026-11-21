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
    // Target answer time of confidence: 1000–3000 in steps of 250.
    readonly targetMs: number;
    readonly sound: boolean;
  };
  readonly updatedAt: number;
};

// Learning (spec metrics.md, "Data model")

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

/** Learning sessions started and finished. */
export type Counters = {
  readonly started: number;
  readonly finished: number;
};

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
  | 'word'; // a word (P12)

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

export type IntroductionEvent = EventId & { readonly t: 'intro'; readonly k: LearnKanaKey };

export type AnswerEvent = EventId & {
  readonly t: 'answer';
  readonly task: TaskKind;
  /** The kana asked: the composite of `build`, the katakana of `transfer`; a `WordKey` only for `word`. */
  readonly k: LearnKanaKey | WordKey;
  readonly ok: boolean;
  /** Answer time, integer ms, 0–10,000 (recall: A37; other tasks: showing the task → the answer). */
  readonly ms: number;
  readonly hint: boolean;
  /** The wrong answer given: the option chosen, or the kana the typed romaji matched (D18). */
  readonly wrong: LearnKanaKey | null;
  /** The other option of a two-option task (`contrast`, `pair`); null otherwise. */
  readonly alt: LearnKanaKey | null;
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

// Sync batches (spec backend.md, "Request and response bodies")

/** The fields of `LearnState`, holding only changes; increments for statistics and buckets. */
export type LearnDelta = {
  /** Changed entries. */
  readonly entries: Readonly<Record<LearnKanaKey, LearnEntry>>;
  /** Newly unlocked kana. */
  readonly unlocked: Readonly<Record<Track, readonly LearnKanaKey[]>>;
  /** New recall answers, at most 10 per kana. */
  readonly recent: Readonly<Record<LearnKanaKey, readonly RecallAnswer[]>>;
  /** Increments. */
  readonly stats: Readonly<Record<LearnKanaKey, LearnStat>>;
  /** Runs of days that became active. */
  readonly activeDays: readonly (readonly [first: number, last: number])[];
  /** Increments. */
  readonly recallBuckets: Readonly<Record<Track, DayBuckets>>;
};

export type SyncDelta = {
  /** Increments. */
  readonly counters: Counters;
  readonly learn: LearnDelta;
  /** Null when unchanged. */
  readonly settings: ValidSettings | null;
};

export type SyncRequest = {
  /** Batch format version. */
  readonly v: 2;
  readonly deviceId: string;
  readonly seq: number;
  readonly delta: SyncDelta;
};

/** `outbox/current` on the device: the one batch awaiting acknowledgement (p5-plan.md, D15). */
export type Outbox = {
  readonly seq: number;
  readonly request: SyncRequest;
};

/** The server's view of one user: what a sync acknowledgement keeps in step (ADR 082). */
export type Snapshot = {
  readonly settings: ValidSettings | null;
  readonly counters: Counters;
  /** The client assembles it from the three parts. */
  readonly learn: LearnState;
};

/** `POST /api/sync`, and `GET /api/sync` without `part`. */
export type SyncResponse = { readonly lastSeq: number; readonly version: number };

/** `GET /api/sync?part=…`; the client stores the three parts only when `version` is the same. */
export type SnapshotRest = SyncResponse & {
  readonly part: 'rest';
  readonly settings: ValidSettings | null;
  readonly counters: Counters;
  readonly learn: Omit<LearnState, 'recent' | 'recallBuckets'>;
};

export type SnapshotRecent = {
  readonly part: 'recent';
  readonly version: number;
  readonly recent: LearnState['recent'];
};

export type SnapshotBuckets = {
  readonly part: 'buckets';
  readonly version: number;
  readonly recallBuckets: LearnState['recallBuckets'];
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
