import type { Strictness } from '@nekotype/engine';
import type { ValidSettings, ValidTestConfig } from '@/shared/lib';

// Derived from the persisted shape, so this slice does not import the prompt slice.
export type ScriptMode = ValidSettings['typing']['script'];

export type ContentKind = ValidSettings['typing']['content'];

export type LearnTrack = ValidSettings['learn']['track'];

export type TestConfig = ValidTestConfig;

export type TimeTestConfig = Extract<TestConfig, { readonly kind: 'time' }>;

export type CountTestConfig = Extract<TestConfig, { readonly kind: 'count' }>;

export type PracticeSettings = {
  readonly script: ScriptMode;
  readonly content: ContentKind;
  readonly strictness: Strictness;
  readonly weakFocus: boolean;
};
