import type { ReadonlySignal } from '@preact/signals';
import { signal } from '@preact/signals';
import type { Strictness } from '@nekotype/engine';
import type {
  PracticeSettings,
  ScriptMode,
  ContentKind,
  TestConfig,
  TimeTestConfig,
  CountTestConfig,
  LearnTrack,
} from './types';
import type { ValidSettings } from '@/shared/lib';
import type { Clock, Db } from '@/shared/lib';
import { defaultClock, isSettings } from '@/shared/lib';

export const DEFAULT_TIME_TEST: TimeTestConfig = { kind: 'time', seconds: 30 };
export const DEFAULT_COUNT_TEST: CountTestConfig = { kind: 'count', prompts: 25 };
export const DEFAULT_TEST_CONFIG: TestConfig = DEFAULT_TIME_TEST;
export const DEFAULT_LEARN_TARGET_MS = 1500;

const SETTINGS_STORE = 'settings';
const SETTINGS_KEY = 'current';

const _scriptSetting = signal<ScriptMode>('both');
const _contentSetting = signal<ContentKind>('words');
const _strictnessSetting = signal<Strictness>('learner');
const _weakFocusSetting = signal<boolean>(true);
const _showTranslationSetting = signal<boolean>(true);
const _testConfig = signal<TestConfig>(DEFAULT_TEST_CONFIG);
const _learnStrictness = signal<Strictness>('learner');
const _learnTrack = signal<LearnTrack>('hiragana');
const _learnTargetMs = signal<number>(DEFAULT_LEARN_TARGET_MS);
// Played after each task from P6; stored so that the document round-trips.
const _learnSound = signal<boolean>(true);
const _updatedAt = signal<number>(0);
const _settingsReady = signal<boolean>(false);

export const scriptSetting: ReadonlySignal<ScriptMode> = _scriptSetting;
export const contentSetting: ReadonlySignal<ContentKind> = _contentSetting;
export const strictnessSetting: ReadonlySignal<Strictness> = _strictnessSetting;
export const weakFocusSetting: ReadonlySignal<boolean> = _weakFocusSetting;
export const showTranslationSetting: ReadonlySignal<boolean> = _showTranslationSetting;
export const testConfig: ReadonlySignal<TestConfig> = _testConfig;
export const learnStrictness: ReadonlySignal<Strictness> = _learnStrictness;
export const learnTrack: ReadonlySignal<LearnTrack> = _learnTrack;
export const learnTargetMs: ReadonlySignal<number> = _learnTargetMs;
/** True once the settings have been read from the database (or defaults were taken). */
export const settingsReady: ReadonlySignal<boolean> = _settingsReady;

let boundDb: Db | null = null;
let boundClock: Clock = defaultClock;

function snapshot(): ValidSettings {
  return {
    typing: {
      script: _scriptSetting.value,
      content: _contentSetting.value,
      strictness: _strictnessSetting.value,
      weakFocus: _weakFocusSetting.value,
      test: _testConfig.value,
      showTranslation: _showTranslationSetting.value,
    },
    learn: {
      strictness: _learnStrictness.value,
      track: _learnTrack.value,
      targetMs: _learnTargetMs.value,
      sound: _learnSound.value,
    },
    updatedAt: _updatedAt.value,
  };
}

function applyDefaults(): void {
  _scriptSetting.value = 'both';
  _contentSetting.value = 'words';
  _strictnessSetting.value = 'learner';
  _weakFocusSetting.value = true;
  _showTranslationSetting.value = true;
  _testConfig.value = DEFAULT_TEST_CONFIG;
  _learnStrictness.value = 'learner';
  _learnTrack.value = 'hiragana';
  _learnTargetMs.value = DEFAULT_LEARN_TARGET_MS;
  _learnSound.value = true;
  _updatedAt.value = 0;
}

/**
 * Each change is written at once, never inside a keystroke handler: settings change on clicks. A
 * transaction started in `pagehide` may not commit before the page unloads, so nothing waits for it.
 */
function persist(): void {
  _updatedAt.value = boundClock.now();
  const db = boundDb;
  if (!db) return;
  db.put(SETTINGS_STORE, SETTINGS_KEY, snapshot()).catch(() => {
    // The write failed (quota, a closed connection): the setting holds for this page load.
  });
}

/**
 * Reads the settings from the `settings` store; a value that fails validation is replaced by the
 * defaults (ADR 061). Resolves once `settingsReady` is true. Never rejects.
 */
export async function initSettings(db: Promise<Db>, clock: Clock = defaultClock): Promise<void> {
  boundClock = clock;
  applyDefaults();
  try {
    const opened = await db;
    boundDb = opened;
    const saved = await opened.get(SETTINGS_STORE, SETTINGS_KEY);
    if (isSettings(saved)) {
      _scriptSetting.value = saved.typing.script;
      _contentSetting.value = saved.typing.content;
      _strictnessSetting.value = saved.typing.strictness;
      _weakFocusSetting.value = saved.typing.weakFocus;
      _showTranslationSetting.value = saved.typing.showTranslation;
      _testConfig.value = saved.typing.test;
      _learnStrictness.value = saved.learn.strictness;
      _learnTrack.value = saved.learn.track;
      _learnTargetMs.value = saved.learn.targetMs;
      _learnSound.value = saved.learn.sound;
      _updatedAt.value = saved.updatedAt;
    }
  } catch {
    // Unreadable: the defaults stand.
  }
  _settingsReady.value = true;
}

export function getPracticeSettings(): PracticeSettings {
  return {
    script: _scriptSetting.value,
    content: _contentSetting.value,
    strictness: _strictnessSetting.value,
    weakFocus: _weakFocusSetting.value,
  };
}

export function setScript(script: ScriptMode): void {
  _scriptSetting.value = script;
  persist();
}

export function setContent(content: ContentKind): void {
  _contentSetting.value = content;
  persist();
}

export function setStrictness(strictness: Strictness): void {
  _strictnessSetting.value = strictness;
  persist();
}

export function setWeakFocus(focus: boolean): void {
  _weakFocusSetting.value = focus;
  persist();
}

// Only what is shown changes, so a running test goes on (it is not among the settings that reset it).
export function setShowTranslation(show: boolean): void {
  _showTranslationSetting.value = show;
  persist();
}

// Changing the test length or kind restarts the session; features/training watches this signal.
export function setTestConfig(config: TestConfig): void {
  _testConfig.value = config;
  persist();
}

export function setLearnStrictness(strictness: Strictness): void {
  _learnStrictness.value = strictness;
  persist();
}

export function setTrack(track: LearnTrack): void {
  _learnTrack.value = track;
  persist();
}

export function setTargetMs(ms: number): void {
  if (!Number.isInteger(ms) || ms < 1000 || ms > 3000 || ms % 250 !== 0) return;
  _learnTargetMs.value = ms;
  persist();
}
