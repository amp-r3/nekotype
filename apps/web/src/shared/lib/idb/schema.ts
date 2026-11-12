import type { StoreDef } from './idb';

/**
 * Grows in the pull request that changes a store or the format of its records. Before the release
 * a mismatch resets the local data (ADR 061); after it, a migration step is required instead.
 */
export const SCHEMA_VERSION = 3;

/** True until the P7 release tag. The release switch sets it to `false` (ADR 061). */
export const PRE_RELEASE = true;

export const DATABASE_NAME = 'nekotype';

/** The stores P4 uses; each phase adds its own. `results` is read newest first and by sync state. */
export const STORES: readonly StoreDef[] = [
  { name: 'settings' },
  { name: 'delta' },
  { name: 'meta' },
  { name: 'results', indexes: ['endedAt', 'synced'] },
  { name: 'records' },
];

export const STORE_NAMES: readonly string[] = STORES.map((s) => s.name);
