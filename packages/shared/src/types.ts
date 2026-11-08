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

export type ValidTestConfig =
  | { readonly kind: 'time'; readonly seconds: 15 | 30 | 60 | 120 }
  | { readonly kind: 'count'; readonly prompts: 10 | 25 | 50 | 100 }
  // No length: the test goes on until it is ended by hand (spec metrics.md, "Test end").
  | { readonly kind: 'zen' };

export type ValidSettings = {
  readonly v: 1;
  readonly script: 'hiragana' | 'katakana' | 'both';
  readonly content: 'words' | 'phrases';
  readonly strictness: 'learner' | 'ime';
  readonly weakFocus: boolean;
  // Added to v1 later: settings saved without it mean `true` (spec storage-sync.md, D18).
  readonly showTranslation?: boolean;
  readonly test: ValidTestConfig;
};

export type ValidKanaStats = {
  readonly a: number;
  readonly m: number;
  readonly t: number;
};

export type ValidProgress = {
  readonly v: 1;
  readonly stats: Record<string, ValidKanaStats>;
};
