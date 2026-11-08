import { describe, it, expect, beforeEach } from 'vitest';
import {
  initSettings,
  settingsReady,
  getPracticeSettings,
  scriptSetting,
  contentSetting,
  strictnessSetting,
  weakFocusSetting,
  showTranslationSetting,
  testConfig,
  learnStrictness,
  learnTrack,
  learnTargetMs,
  DEFAULT_TEST_CONFIG,
  DEFAULT_TIME_TEST,
  DEFAULT_COUNT_TEST,
  setTestConfig,
  setScript,
  setContent,
  setStrictness,
  setWeakFocus,
  setShowTranslation,
  setLearnStrictness,
  setTrack,
  setTargetMs,
} from './store';
import { createMemoryDb } from '@/shared/lib';
import type { Db, Clock } from '@/shared/lib';

const fixedClock = (now: number): Clock => ({ now: () => now });

// Counts the writes the store makes.
function countingDb(): { db: Db; puts: () => number } {
  const inner = createMemoryDb();
  let puts = 0;
  return {
    db: {
      ...inner,
      put: (store, key, value) => {
        puts++;
        return inner.put(store, key, value);
      },
    },
    puts: () => puts,
  };
}

const flush = (): Promise<void> => new Promise((resolve) => setTimeout(resolve, 0));

const savedDocument = {
  typing: {
    script: 'katakana',
    content: 'phrases',
    strictness: 'ime',
    weakFocus: false,
    test: { kind: 'count', prompts: 50 },
    showTranslation: false,
  },
  learn: { strictness: 'ime', track: 'katakana', targetMs: 2000, sound: false },
  updatedAt: 42,
};

describe('settings store: actions and persistence in IndexedDB', () => {
  let db: Db;

  beforeEach(async () => {
    db = createMemoryDb();
    await initSettings(Promise.resolve(db));
  });

  it('is ready once loaded, with the defaults on an empty database', () => {
    expect(settingsReady.value).toBe(true);
    expect(scriptSetting.value).toBe('both');
    expect(contentSetting.value).toBe('words');
    expect(showTranslationSetting.value).toBe(true);
    expect(learnStrictness.value).toBe('learner');
    expect(learnTrack.value).toBe('hiragana');
    expect(learnTargetMs.value).toBe(1500);
  });

  it('typing actions update the signals and getPracticeSettings', () => {
    setScript('katakana');
    setContent('phrases');
    setStrictness('ime');
    setWeakFocus(false);
    expect(scriptSetting.value).toBe('katakana');
    expect(contentSetting.value).toBe('phrases');
    expect(strictnessSetting.value).toBe('ime');
    expect(weakFocusSetting.value).toBe(false);
    expect(getPracticeSettings()).toEqual({
      script: 'katakana',
      content: 'phrases',
      strictness: 'ime',
      weakFocus: false,
    });
    expect(getPracticeSettings()).not.toHaveProperty('showTranslation');
  });

  it('a change is stored at once, without waiting for pagehide, and loads back', async () => {
    setScript('katakana');
    setContent('phrases');
    setStrictness('ime');
    setWeakFocus(false);
    setShowTranslation(false);
    setTestConfig({ kind: 'zen' });
    setLearnStrictness('ime');
    setTrack('katakana');
    setTargetMs(2250);
    await flush();

    await initSettings(Promise.resolve(db));
    expect(scriptSetting.value).toBe('katakana');
    expect(contentSetting.value).toBe('phrases');
    expect(strictnessSetting.value).toBe('ime');
    expect(weakFocusSetting.value).toBe(false);
    expect(showTranslationSetting.value).toBe(false);
    expect(testConfig.value).toEqual({ kind: 'zen' });
    expect(learnStrictness.value).toBe('ime');
    expect(learnTrack.value).toBe('katakana');
    expect(learnTargetMs.value).toBe(2250);
  });

  it('stores the spec shape with updatedAt from the clock', async () => {
    const counting = countingDb();
    await initSettings(Promise.resolve(counting.db), fixedClock(1234));
    setTrack('katakana');
    await flush();
    expect(await counting.db.get('settings', 'current')).toEqual({
      typing: {
        script: 'both',
        content: 'words',
        strictness: 'learner',
        weakFocus: true,
        test: DEFAULT_TEST_CONFIG,
        showTranslation: true,
      },
      learn: { strictness: 'learner', track: 'katakana', targetMs: 1500, sound: true },
      updatedAt: 1234,
    });
  });

  it('writes once per change and never on load', async () => {
    const counting = countingDb();
    await initSettings(Promise.resolve(counting.db));
    expect(counting.puts()).toBe(0);
    setScript('hiragana');
    setScript('katakana');
    expect(counting.puts()).toBe(2);
  });

  it('keeps a saved document, including the sound flag it has no control for yet', async () => {
    await db.put('settings', 'current', savedDocument);
    await initSettings(Promise.resolve(db));
    expect(scriptSetting.value).toBe('katakana');
    expect(learnTargetMs.value).toBe(2000);
    setTrack('hiragana');
    await flush();
    expect(await db.get('settings', 'current')).toMatchObject({
      learn: { track: 'hiragana', sound: false, targetMs: 2000 },
    });
  });

  it('a saved value that fails validation is replaced by the defaults (ADR 061)', async () => {
    for (const bad of [
      'x',
      { ...savedDocument, typing: { ...savedDocument.typing, content: 'single' } },
      { ...savedDocument, learn: { ...savedDocument.learn, targetMs: 1100 } },
      { v: 1, script: 'katakana', content: 'words', strictness: 'ime', weakFocus: true },
    ]) {
      await db.put('settings', 'current', bad);
      await initSettings(Promise.resolve(db));
      expect(settingsReady.value).toBe(true);
      expect(scriptSetting.value).toBe('both');
      expect(contentSetting.value).toBe('words');
      expect(learnTargetMs.value).toBe(1500);
    }
  });

  it('an unreadable database leaves the defaults and still becomes ready', async () => {
    await initSettings(Promise.reject(new Error('no database')));
    expect(settingsReady.value).toBe(true);
    expect(scriptSetting.value).toBe('both');
  });

  it('a failing write does not break the action', async () => {
    const failing: Db = { ...createMemoryDb(), put: () => Promise.reject(new Error('quota')) };
    await initSettings(Promise.resolve(failing));
    setScript('hiragana');
    await flush();
    expect(scriptSetting.value).toBe('hiragana');
  });

  it('setTargetMs accepts 1000–3000 in steps of 250 and ignores other values', () => {
    setTargetMs(3000);
    expect(learnTargetMs.value).toBe(3000);
    setTargetMs(1100);
    setTargetMs(500);
    setTargetMs(3250);
    expect(learnTargetMs.value).toBe(3000);
  });

  it('names the defaults of each test kind, and the initial test is the time default', () => {
    expect(DEFAULT_TIME_TEST).toEqual({ kind: 'time', seconds: 30 });
    expect(DEFAULT_COUNT_TEST).toEqual({ kind: 'count', prompts: 25 });
    expect(DEFAULT_TEST_CONFIG).toBe(DEFAULT_TIME_TEST);
  });
});
