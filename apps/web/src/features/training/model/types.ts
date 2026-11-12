import type { TestEndReason } from '@nekotype/shared/types';
import type { KanaStat } from '@nekotype/shared/types';
import type { TestConfig } from '@/entities/settings';
import type { Strictness } from '@/entities/prompt';

export type Phase = 'idle' | 'running' | 'finished';

export type TokenOutcome = {
  readonly kanaKey: string | null;
  readonly mistakes: number;
  readonly ms: number;
};

export type PromptResult = {
  readonly key: string;
  readonly startedAt: number;
  readonly endedAt: number;
  readonly mistakes: number;
  readonly assisted: boolean;
  readonly tokenOutcomes: readonly TokenOutcome[];
};

// The raw counts of a finished test; the results screen reads the saved `TestResult` instead.
export type SessionMetrics = {
  readonly elapsedMs: number;
  readonly correct: number;
  readonly mistakes: number;
  readonly accuracy: number;
  readonly promptsCompleted: number;
};

/**
 * What a session reports when a test ends and is to be kept (metrics.md, T4). The trainer adds the
 * settings, the id and the versions and turns it into a `TestResult`.
 */
export type EndedTest = {
  readonly endReason: TestEndReason;
  readonly config: TestConfig;
  readonly strictness: Strictness;
  readonly startedAt: number;
  readonly endedAt: number;
  readonly durationMs: number;
  /** Committed tokens, the unfinished prompt included, and the errored ones among them. */
  readonly tokens: number;
  readonly erroredTokens: number;
  /** Completed prompts. */
  readonly items: number;
  /** Latin keys handled: accepted and rejected. */
  readonly keystrokes: number;
  readonly rejectedKeystrokes: number;
  /** Hints (Esc). */
  readonly assisted: number;
  /** Committed tokens per kana, and the errored ones; also the errors of the test per kana. */
  readonly kanaDelta: Readonly<Record<string, KanaStat>>;
};
