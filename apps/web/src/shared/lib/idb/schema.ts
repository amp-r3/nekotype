/**
 * Grows in the pull request that changes a store or the format of its records. Before the release
 * a mismatch resets the local data (ADR 061); after it, a migration step is required instead.
 */
export const SCHEMA_VERSION = 1;

/** True until the P7 release tag. The release switch sets it to `false` (ADR 061). */
export const PRE_RELEASE = true;

export const DATABASE_NAME = 'nekotype';

/** The stores P3 uses; each phase adds its own. */
export const STORES = ['settings', 'delta', 'meta'] as const;
