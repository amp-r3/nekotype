export type { Rng, Clock, Scheduler, TimeoutHandle } from '@nekotype/shared/types';
export { defaultRng } from './rng';

export { defaultClock } from './clock';

export { defaultScheduler } from './scheduler';

export { cx } from './cx';

export { useMediaQuery } from './use-media-query';

export { isApplePlatform } from './platform';

export { currentPath, navigate, startRouter, isPlainLeftClick } from './router';

export { DEFAULT_BASIC_ROWS } from './default-rows';

export type { KeyValueStore } from './storage';
export {
  MemoryKeyValueStore,
  LocalStorageStore,
  STORAGE_KEYS,
  createDebouncedSaver,
} from './storage';

export type {
  ValidTestConfig,
  ValidSettings,
  ValidKanaStats,
  ValidProgress,
} from '@nekotype/shared/types';

export {
  isObject,
  isTestConfig,
  isSettings,
  isKanaStats,
  isProgress,
} from '@nekotype/shared/runtime';

export type { KeyIntent } from './input/input-adapter';
export type { InputSource, InputSourceDeps } from './input/input-source';
export { createInputSource } from './input/input-source';
