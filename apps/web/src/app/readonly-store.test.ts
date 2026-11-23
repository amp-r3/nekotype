import { describe, it, expect } from 'vitest';
import { learnReady, learnView } from '@/entities/learn';
import { locale } from '@/shared/i18n';

// Compile-checked type helper: verifies property 'value' is readonly without @ts-expect-error
type IfEquals<X, Y, A = true, B = false> =
  (<T>(x: T) => T extends X ? 1 : 2) extends <T>(x: T) => T extends Y ? 1 : 2 ? A : B;

type IsWritable<T, K extends keyof T> = IfEquals<{ [Q in K]: T[Q] }, { -readonly [Q in K]: T[Q] }>;

type AssertFalse<T extends false> = T;

// Static type assertions: these fail compilation (tsc --noEmit) if .value is writable
export type _CheckLearnView = AssertFalse<IsWritable<typeof learnView, 'value'>>;
export type _CheckLearnReady = AssertFalse<IsWritable<typeof learnReady, 'value'>>;
export type _CheckLocale = AssertFalse<IsWritable<typeof locale, 'value'>>;

describe('store state: ReadonlySignal guarantees', () => {
  it('all store signals are exposed as ReadonlySignal', () => {
    // Runtime confirmation that signals are defined and readable
    expect(locale.value).toBeDefined();
    expect(learnReady.value).toBe(false);
    expect(learnView.value).toBeNull();
  });
});
