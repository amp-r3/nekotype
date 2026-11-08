export type { Rng, Clock, Scheduler, TimeoutHandle } from '@nekotype/shared/types';
export { defaultRng } from './rng';

export { defaultClock } from './clock';

export { defaultScheduler } from './scheduler';

export { cx } from './cx';

export { useMediaQuery } from './use-media-query';

export { isApplePlatform } from './platform';

export { currentPath, navigate, startRouter, isPlainLeftClick } from './router';

export type { KeyValueStore } from './storage';
export {
  MemoryKeyValueStore,
  LocalStorageStore,
  STORAGE_KEYS,
  createDebouncedSaver,
  LEGACY_KEYS,
  removeLegacyKeys,
} from './storage';

export type { Db, Write } from './idb/idb';
export type { DatabaseMode, DatabaseProvider } from './idb/database';
export { getDatabase, databaseMode, openDatabase, createDatabaseProvider } from './idb/database';
export { SCHEMA_VERSION, PRE_RELEASE, DATABASE_NAME, STORES } from './idb/schema';

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
