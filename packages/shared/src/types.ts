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

export type ValidKanaStats = {
  readonly a: number;
  readonly m: number;
  readonly t: number;
};

export type ValidProgress = {
  readonly v: 1;
  readonly stats: Record<string, ValidKanaStats>;
};
