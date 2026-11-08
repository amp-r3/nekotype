import { describe, it, expect, beforeEach } from 'vitest';
import {
  initSettings,
  flushSettings,
  getPracticeSettings,
  scriptSetting,
  contentSetting,
  strictnessSetting,
  weakFocusSetting,
  showTranslationSetting,
  testConfig,
  DEFAULT_TEST_CONFIG,
  DEFAULT_TIME_TEST,
  DEFAULT_COUNT_TEST,
  setTestConfig,
  setScript,
  setContent,
  setStrictness,
  setWeakFocus,
  setShowTranslation,
} from './store';
import { MemoryKeyValueStore, STORAGE_KEYS } from '@/shared/lib';

describe('practice-settings store: domain rules, actions and persistence', () => {
  let store: MemoryKeyValueStore;

  beforeEach(() => {
    store = new MemoryKeyValueStore();
    initSettings(store);
  });

  it('script switch updates scriptSetting and getPracticeSettings', () => {
    setScript('hiragana');
    expect(scriptSetting.value).toBe('hiragana');
    expect(getPracticeSettings().script).toBe('hiragana');

    setScript('katakana');
    expect(scriptSetting.value).toBe('katakana');

    setScript('both');
    expect(scriptSetting.value).toBe('both');
  });

  it('content, strictness, and weakFocus switches update settings', () => {
    setContent('words');
    expect(contentSetting.value).toBe('words');

    setStrictness('ime');
    expect(strictnessSetting.value).toBe('ime');

    setWeakFocus(false);
    expect(weakFocusSetting.value).toBe(false);

    setWeakFocus(true);
    expect(weakFocusSetting.value).toBe(true);
  });

  it('persistence round-trip saves and restores settings correctly', () => {
    setScript('katakana');
    setContent('phrases');
    setStrictness('ime');
    setWeakFocus(false);
    flushSettings();

    // Verify stored JSON
    const raw = store.get(STORAGE_KEYS.SETTINGS);
    expect(raw).not.toBeNull();

    // Create fresh store instance and re-hydrate
    initSettings(store);
    expect(scriptSetting.value).toBe('katakana');
    expect(contentSetting.value).toBe('phrases');
    expect(strictnessSetting.value).toBe('ime');
    expect(weakFocusSetting.value).toBe(false);
  });

  it('corrupted or wrong-version settings fall back to defaults', () => {
    // 1. Corrupted JSON
    store.set(STORAGE_KEYS.SETTINGS, '{invalid json');
    initSettings(store);
    expect(scriptSetting.value).toBe('both');
    expect(contentSetting.value).toBe('words');

    // 2. Wrong version schema (e.g. v: 2)
    const wrongVersion = {
      v: 2,
      script: 'katakana',
      content: 'words',
      strictness: 'ime',
      weakFocus: true,
      test: { kind: 'time', seconds: 30 },
    };
    store.set(STORAGE_KEYS.SETTINGS, JSON.stringify(wrongVersion));
    initSettings(store);
    // Should retain valid defaults
    expect(scriptSetting.value).toBe('both');
  });

  it('settings saved with the removed single-kana content fall back to the defaults (ADR 061)', () => {
    setScript('katakana');
    store.set(
      STORAGE_KEYS.SETTINGS,
      JSON.stringify({
        v: 1,
        script: 'katakana',
        content: 'single',
        strictness: 'ime',
        rowIds: ['vowels'],
        weakFocus: false,
        test: { kind: 'time', seconds: 60 },
      }),
    );
    initSettings(store);
    expect(scriptSetting.value).toBe('both');
    expect(contentSetting.value).toBe('words');
    expect(strictnessSetting.value).toBe('learner');
    expect(testConfig.value).toEqual(DEFAULT_TEST_CONFIG);
  });

  it('setTestConfig updates the config and persists it together with the practice settings', () => {
    setContent('words');
    setTestConfig({ kind: 'count', prompts: 50 });
    expect(testConfig.value).toEqual({ kind: 'count', prompts: 50 });
    flushSettings();

    const saved: unknown = JSON.parse(store.get(STORAGE_KEYS.SETTINGS) ?? 'null');
    expect(saved).toMatchObject({
      v: 1,
      content: 'words',
      test: { kind: 'count', prompts: 50 },
    });

    initSettings(store);
    expect(testConfig.value).toEqual({ kind: 'count', prompts: 50 });
    expect(contentSetting.value).toBe('words');
  });

  it('names the defaults of each test kind, and the initial test is the time default', () => {
    expect(DEFAULT_TIME_TEST).toEqual({ kind: 'time', seconds: 30 });
    expect(DEFAULT_COUNT_TEST).toEqual({ kind: 'count', prompts: 25 });
    expect(DEFAULT_TEST_CONFIG).toBe(DEFAULT_TIME_TEST);
  });

  it('a corrupted settings value falls back to the default test config', () => {
    setTestConfig({ kind: 'time', seconds: 120 });
    store.set(STORAGE_KEYS.SETTINGS, '{invalid json');
    initSettings(store);
    expect(testConfig.value).toEqual(DEFAULT_TEST_CONFIG);
  });

  it('a zen test is saved and restored, and settings saved before it existed still load', () => {
    setTestConfig({ kind: 'zen' });
    flushSettings();
    initSettings(store);
    expect(testConfig.value).toEqual({ kind: 'zen' });

    store.set(
      STORAGE_KEYS.SETTINGS,
      JSON.stringify({
        v: 1,
        script: 'hiragana',
        content: 'words',
        strictness: 'ime',
        weakFocus: false,
        test: { kind: 'count', prompts: 25 },
      }),
    );
    initSettings(store);
    expect(testConfig.value).toEqual({ kind: 'count', prompts: 25 });
    expect(contentSetting.value).toBe('words');
  });

  it('showTranslation is on by default, also for settings saved without the field', () => {
    expect(showTranslationSetting.value).toBe(true);
    store.set(
      STORAGE_KEYS.SETTINGS,
      JSON.stringify({
        v: 1,
        script: 'katakana',
        content: 'words',
        strictness: 'ime',
        weakFocus: true,
        test: { kind: 'time', seconds: 30 },
      }),
    );
    setShowTranslation(false);
    initSettings(store);
    expect(scriptSetting.value).toBe('katakana');
    expect(showTranslationSetting.value).toBe(true);
  });

  it('showTranslation is saved and restored', () => {
    setShowTranslation(false);
    flushSettings();
    const saved: unknown = JSON.parse(store.get(STORAGE_KEYS.SETTINGS) ?? 'null');
    expect(saved).toMatchObject({ showTranslation: false });

    setShowTranslation(true);
    initSettings(store);
    expect(showTranslationSetting.value).toBe(false);
  });

  it('showTranslation is not a practice setting', () => {
    expect(getPracticeSettings()).not.toHaveProperty('showTranslation');
  });
});
