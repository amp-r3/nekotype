export type { Rng, Clock, Scheduler, TimeoutHandle } from '@nekotype/shared/types';
export { defaultRng } from './rng';

export { defaultClock } from './time/clock';

export { defaultScheduler } from './time/scheduler';

export { cx } from './cx';

export { useMediaQuery } from './use-media-query';

export { useEnterForNext } from './input/use-enter-for-next';

export { isApplePlatform, useOnline } from './platform';

export {
  currentPath,
  navigate,
  startRouter,
  isPlainLeftClick,
  immersive,
  setImmersive,
} from './router';

export type { KeyValueStore } from './storage';
export {
  MemoryKeyValueStore,
  LocalStorageStore,
  STORAGE_KEYS,
  LEGACY_KEYS,
  removeLegacyKeys,
} from './storage';

export type { ChangeChannel, ChannelMessage } from './idb/channel';
export { changeChannel } from './idb/channel';
export type { Db, Read, Write } from './idb/idb';
export type { SyncBase } from './idb/local-sync';
export {
  DELTA_STORE,
  META_STORE,
  OUTBOX_STORE,
  SNAPSHOT_STORE,
  SYNC_KEY,
  readWithSyncBase,
} from './idb/local-sync';
export { createMemoryDb } from './idb/memory-db';
export { recordWrites } from './idb/record-writes';
export type { DatabaseMode, DatabaseProvider } from './idb/database';
export {
  getDatabase,
  databaseMode,
  openDatabase,
  createDatabaseProvider,
  reportWriteFailure,
} from './idb/database';
export { SCHEMA_VERSION, PRE_RELEASE, DATABASE_NAME, STORES } from './idb/schema';

export type { ValidTestConfig, ValidSettings } from '@nekotype/shared/types';

export { isObject, isTestConfig, isSettings } from '@nekotype/shared/runtime';

export type { KeyIntent } from './input/input-adapter';
export type { InputSource, InputSourceDeps } from './input/input-source';
export { createInputSource } from './input/input-source';

export { uuidv7 } from './uuid';

export type { SyncReason } from './idb/sync-request';
export { requestSync, onSyncRequest } from './idb/sync-request';
