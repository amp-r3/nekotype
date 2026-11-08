import { describe, it, expect } from 'vitest';
import {
  scriptSetting,
  contentSetting,
  strictnessSetting,
  weakFocusSetting,
  showTranslationSetting,
  testConfig,
} from '@/entities/settings';
import { progressStats } from '@/entities/stats';
import { createSession } from '@/features/training';
import type { Session } from '@/features/training';
import { locale } from '@/shared/i18n';

// Compile-checked type helper: verifies property 'value' is readonly without @ts-expect-error
type IfEquals<X, Y, A = true, B = false> =
  (<T>(x: T) => T extends X ? 1 : 2) extends <T>(x: T) => T extends Y ? 1 : 2 ? A : B;

type IsWritable<T, K extends keyof T> = IfEquals<{ [Q in K]: T[Q] }, { -readonly [Q in K]: T[Q] }>;

type AssertFalse<T extends false> = T;

// Static type assertions: these fail compilation (tsc --noEmit) if .value is writable
export type _CheckScriptSetting = AssertFalse<IsWritable<typeof scriptSetting, 'value'>>;
export type _CheckContentSetting = AssertFalse<IsWritable<typeof contentSetting, 'value'>>;
export type _CheckStrictnessSetting = AssertFalse<IsWritable<typeof strictnessSetting, 'value'>>;
export type _CheckWeakFocusSetting = AssertFalse<IsWritable<typeof weakFocusSetting, 'value'>>;
export type _CheckShowTranslationSetting = AssertFalse<
  IsWritable<typeof showTranslationSetting, 'value'>
>;
export type _CheckTestConfig = AssertFalse<IsWritable<typeof testConfig, 'value'>>;
export type _CheckProgressStats = AssertFalse<IsWritable<typeof progressStats, 'value'>>;
export type _CheckLocale = AssertFalse<IsWritable<typeof locale, 'value'>>;

// Controller signal checks:
export type _CheckCtrlIsAssisted = AssertFalse<IsWritable<Session['isAssisted'], 'value'>>;
export type _CheckCtrlCurrentPrompt = AssertFalse<IsWritable<Session['currentPrompt'], 'value'>>;
export type _CheckCtrlCanonicalRomaji = AssertFalse<
  IsWritable<Session['canonicalRomaji'], 'value'>
>;
export type _CheckCtrlTickerNow = AssertFalse<IsWritable<Session['tickerNow'], 'value'>>;
export type _CheckStream = AssertFalse<IsWritable<Session['stream'], 'value'>>;
export type _CheckCaret = AssertFalse<IsWritable<Session['caret'], 'value'>>;
export type _CheckRomajiBuffer = AssertFalse<IsWritable<Session['romajiBuffer'], 'value'>>;
export type _CheckMistake = AssertFalse<IsWritable<Session['mistake'], 'value'>>;
export type _CheckPhase = AssertFalse<IsWritable<Session['phase'], 'value'>>;
export type _CheckMetrics = AssertFalse<IsWritable<Session['metrics'], 'value'>>;
export type _CheckPromptResults = AssertFalse<IsWritable<Session['promptResults'], 'value'>>;
export type _CheckCorrectKeystrokes = AssertFalse<
  IsWritable<Session['correctKeystrokes'], 'value'>
>;
export type _CheckSessionStartedAt = AssertFalse<IsWritable<Session['sessionStartedAt'], 'value'>>;
export type _CheckLiveKpm = AssertFalse<IsWritable<Session['liveKpm'], 'value'>>;
export type _CheckLiveAccuracy = AssertFalse<IsWritable<Session['liveAccuracy'], 'value'>>;

describe('store state: ReadonlySignal guarantees', () => {
  it('all store signals and controller signals are exposed as ReadonlySignal', () => {
    // Runtime confirmation that signals are defined and readable
    expect(scriptSetting.value).toBeDefined();
    expect(contentSetting.value).toBeDefined();
    expect(strictnessSetting.value).toBeDefined();
    expect(weakFocusSetting.value).toBeDefined();
    expect(showTranslationSetting.value).toBeDefined();
    expect(testConfig.value).toBeDefined();
    expect(progressStats.value).toBeDefined();
    expect(locale.value).toBeDefined();

    const dummyController = createSession({
      nextPrompt: () => ({ key: 'basic:a', text: 'あ' }),
      config: () => testConfig.value,
    });
    expect(dummyController.stream.value.prompts).toEqual([]);
    expect(dummyController.caret.value).toBe(0);
    expect(dummyController.romajiBuffer.value).toBe('');
    expect(dummyController.mistake.value).toBeNull();
    expect(dummyController.isAssisted.value).toBeDefined();
    expect(dummyController.currentPrompt.value).toBeNull();
    expect(dummyController.canonicalRomaji.value).toBeDefined();
    expect(dummyController.tickerNow.value).toBeDefined();
    expect(dummyController.phase.value).toBe('idle');
    expect(dummyController.metrics.value).toBeNull();
    expect(dummyController.promptResults.value).toEqual([]);
    expect(dummyController.correctKeystrokes.value).toBe(0);
    expect(dummyController.sessionStartedAt.value).toBe(0);
    expect(dummyController.liveKpm.value).toBe(0);
    expect(dummyController.liveAccuracy.value).toBe(100);
  });
});
