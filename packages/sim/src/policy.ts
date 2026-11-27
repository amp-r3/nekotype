/** What a candidate model shows and asks; the harness plays the learner's side. */

export type TaskKind = 'introduction' | 'recall' | 'recognition' | 'word';

export interface Task {
  readonly item: number;
  readonly kind: TaskKind;
  /** The 4 options of a recognition task, the answer among them. */
  readonly options: readonly number[];
  /** A scheduled review of a kana the policy holds as learned: what the retention goal counts. */
  readonly review: boolean;
  /** The kana of a word task in reading order (P9 research, part 2); `item` is the first of them. */
  readonly word?: readonly number[];
}

/** One kana of a word as the learner read it. */
export interface KanaRead {
  readonly item: number;
  readonly ok: boolean;
  readonly ms: number;
  /** The kana read instead, when the error was a confusion with a similar kana. */
  readonly confusedWith: number | undefined;
}

export interface Answer {
  readonly task: Task;
  readonly ok: boolean;
  readonly ms: number;
  readonly at: number;
  /** The kana chosen in recognition, or the kana a recall error was confused with. */
  readonly wrong: number | undefined;
  /** A recall's true probability before the answer: only an oracle grade reads it. */
  readonly p?: number;
  /** A word task: each kana as it was read; `ok` is true when all of them were. */
  readonly reads?: readonly KanaRead[];
}

export type SessionKind = 'learning' | 'review';

export interface Session {
  readonly kind: SessionKind;
  /** The next task, or undefined when the session is over. */
  next(now: number): Task | undefined;
  record(answer: Answer): void;
}

/** `raw` is the median before the correction by the history; the rest follow it. */
export interface ForecastAnswer {
  readonly raw: number;
  readonly low: number;
  readonly median: number;
  readonly high: number;
}

export interface Policy {
  readonly name: string;
  /** The session the learner starts now; `first` is true for the first session of a sitting. */
  session(now: number, first: boolean): Session;
  /** Kana the policy has unlocked so far. */
  unlocked(): number;
  /**
   * The production model's forecast of the sessions until every item of `ids` (one row) is
   * introduced, made at `now`; `history` holds the settled raw forecasts. Only the production
   * policy has it (P7 plan, D8): the harness asks, and counts what really happened.
   */
  forecast?(
    ids: readonly number[],
    now: number,
    history: readonly { readonly forecast: number; readonly actual: number }[],
  ): ForecastAnswer | undefined;
  /** The memory model chosen at each fit, when the policy fits one (part 3). */
  readonly fits?: readonly string[];
  /**
   * Answers of a placement test before the first session (adaptive answer-time research): a
   * policy that has it uses them for the answer-time threshold only.
   */
  calibrate?(answers: readonly Answer[]): void;
  /** Whether the policy holds the kana as learned now; only the production policy has it (P9 research). */
  learned?(id: number): boolean;
}
