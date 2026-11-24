import type { StoreDef } from './idb';

/**
 * Grows in the pull request that changes a store or the format of its records. Before the release
 * a mismatch resets the local data (ADR 061); after it, a migration step is required instead.
 */
export const SCHEMA_VERSION = 7;

/** True until the P14 release tag. The release switch sets it to `false` (ADR 061). */
export const PRE_RELEASE = true;

export const DATABASE_NAME = 'nekotype';

/**
 * The stores of the application; each phase adds its own. `log` (schema 6, P7) holds the learning
 * log, own pages and pulled server rows (sync format 3). `forecasts` (schema 7, P8) holds the
 * forecast history of this device: never synced.
 */
export const STORES: readonly StoreDef[] = [
  { name: 'settings' },
  { name: 'log' },
  { name: 'forecasts' },
  { name: 'outbox' },
  { name: 'meta' },
];

export const STORE_NAMES: readonly string[] = STORES.map((s) => s.name);
