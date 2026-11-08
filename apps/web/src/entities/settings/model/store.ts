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
} from './types';
import type { KeyValueStore } from '@/shared/lib';
import { STORAGE_KEYS, isSettings, createDebouncedSaver } from '@/shared/lib';

export const DEFAULT_TIME_TEST: TimeTestConfig = { kind: 'time', seconds: 30 };
export const DEFAULT_COUNT_TEST: CountTestConfig = { kind: 'count', prompts: 25 };
export const DEFAULT_TEST_CONFIG: TestConfig = DEFAULT_TIME_TEST;

const _scriptSetting = signal<ScriptMode>('both');
const _contentSetting = signal<ContentKind>('words');
const _strictnessSetting = signal<Strictness>('learner');
const _weakFocusSetting = signal<boolean>(true);
const _showTranslationSetting = signal<boolean>(true);
const _testConfig = signal<TestConfig>(DEFAULT_TEST_CONFIG);

export const scriptSetting: ReadonlySignal<ScriptMode> = _scriptSetting;
export const contentSetting: ReadonlySignal<ContentKind> = _contentSetting;
export const strictnessSetting: ReadonlySignal<Strictness> = _strictnessSetting;
export const weakFocusSetting: ReadonlySignal<boolean> = _weakFocusSetting;
export const showTranslationSetting: ReadonlySignal<boolean> = _showTranslationSetting;
export const testConfig: ReadonlySignal<TestConfig> = _testConfig;

let boundStore: KeyValueStore | null = null;
let debouncedSaver: ReturnType<typeof createDebouncedSaver> | null = null;

function saveCurrentSettings(): void {
  if (!boundStore) return;
  const full = {
    v: 1 as const,
    script: _scriptSetting.value,
    content: _contentSetting.value,
    strictness: _strictnessSetting.value,
    weakFocus: _weakFocusSetting.value,
    showTranslation: _showTranslationSetting.value,
    test: _testConfig.value,
  };
  try {
    boundStore.set(STORAGE_KEYS.SETTINGS, JSON.stringify(full));
  } catch {
    // Ignore error
  }
}

export function flushSettings(): void {
  debouncedSaver?.flush();
}

function notifyChange(): void {
  if (debouncedSaver) {
    debouncedSaver.trigger();
  }
}

export function initSettings(store: KeyValueStore): void {
  boundStore = store;
  debouncedSaver = createDebouncedSaver(saveCurrentSettings, 300);

  const raw = store.get(STORAGE_KEYS.SETTINGS);
  if (raw) {
    try {
      const parsed: unknown = JSON.parse(raw);
      if (isSettings(parsed)) {
        _scriptSetting.value = parsed.script;
        _contentSetting.value = parsed.content;
        _strictnessSetting.value = parsed.strictness;
        _weakFocusSetting.value = parsed.weakFocus;
        _showTranslationSetting.value = parsed.showTranslation ?? true;
        _testConfig.value = parsed.test;
        return;
      }
    } catch {
      // Fallback silently to defaults
    }
  }

  // Fallback to defaults
  _scriptSetting.value = 'both';
  _contentSetting.value = 'words';
  _strictnessSetting.value = 'learner';
  _weakFocusSetting.value = true;
  _showTranslationSetting.value = true;
  _testConfig.value = DEFAULT_TEST_CONFIG;
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
  notifyChange();
}

export function setContent(content: ContentKind): void {
  _contentSetting.value = content;
  notifyChange();
}

export function setStrictness(strictness: Strictness): void {
  _strictnessSetting.value = strictness;
  notifyChange();
}

export function setWeakFocus(focus: boolean): void {
  _weakFocusSetting.value = focus;
  notifyChange();
}

// Only what is shown changes, so a running test goes on (it is not among the settings that reset it).
export function setShowTranslation(show: boolean): void {
  _showTranslationSetting.value = show;
  notifyChange();
}

// Changing the test length or kind restarts the session; features/training watches this signal.
export function setTestConfig(config: TestConfig): void {
  _testConfig.value = config;
  notifyChange();
}
