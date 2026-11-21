/** What a candidate model shows and asks; the harness plays the learner's side. */

export type TaskKind = 'introduction' | 'recall' | 'recognition';

export interface Task {
  readonly item: number;
  readonly kind: TaskKind;
  /** The 4 options of a recognition task, the answer among them. */
  readonly options: readonly number[];
  /** A scheduled review of a kana the policy holds as learned: what the retention goal counts. */
  readonly review: boolean;
}

export interface Answer {
  readonly task: Task;
  readonly ok: boolean;
  readonly ms: number;
  readonly at: number;
  /** The kana chosen in recognition, or the kana a recall error was confused with. */
  readonly wrong: number | undefined;
}

export type SessionKind = 'learning' | 'review';

export interface Session {
  readonly kind: SessionKind;
  /** The next task, or undefined when the session is over. */
  next(now: number): Task | undefined;
  record(answer: Answer): void;
}

export interface Policy {
  readonly name: string;
  /** The session the learner starts now; `first` is true for the first session of a sitting. */
  session(now: number, first: boolean): Session;
  /** Kana the policy has unlocked so far. */
  unlocked(): number;
  /** The memory model chosen at each fit, when the policy fits one (part 3). */
  readonly fits?: readonly string[];
}
