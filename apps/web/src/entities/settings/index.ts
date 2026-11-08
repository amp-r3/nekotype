export type {
  ScriptMode,
  ContentKind,
  PracticeSettings,
  TestConfig,
  TimeTestConfig,
  CountTestConfig,
} from './model/types';

export {
  scriptSetting,
  contentSetting,
  strictnessSetting,
  weakFocusSetting,
  showTranslationSetting,
  testConfig,
  DEFAULT_TEST_CONFIG,
  DEFAULT_TIME_TEST,
  DEFAULT_COUNT_TEST,
  initSettings,
  flushSettings,
  getPracticeSettings,
  setScript,
  setContent,
  setStrictness,
  setWeakFocus,
  setShowTranslation,
  setTestConfig,
} from './model/store';
