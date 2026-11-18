import type {
  Snapshot,
  SnapshotBuckets,
  SnapshotRecent,
  SnapshotRest,
  ValidSettings,
} from '@nekotype/shared/types';

/** The three parts of `GET /api/sync` as one snapshot (ADR 082). */
export function assembleSnapshot(
  rest: SnapshotRest,
  recent: SnapshotRecent,
  buckets: SnapshotBuckets,
): Snapshot {
  return {
    settings: rest.settings,
    kanaStats: rest.kanaStats,
    counters: rest.counters,
    learn: { ...rest.learn, recent: recent.recent, recallBuckets: buckets.recallBuckets },
    typingRecords: rest.typingRecords,
  };
}

/**
 * An acknowledgement whose `version` is the stored one plus 1 means only this batch was written
 * since the snapshot: the client applies it itself. Without a snapshot, or with any other version,
 * the snapshot is read from the server (ADR 082).
 */
export function appliesLocally(
  snapshot: Snapshot | null,
  snapshotVersion: number | null,
  version: number,
): boolean {
  return snapshot !== null && snapshotVersion !== null && version === snapshotVersion + 1;
}

export type SettingsAfter = {
  /** The document to store in place of the local one, or null to keep it. */
  readonly replace: ValidSettings | null;
  /** The new `meta.settingsSyncedAt`. */
  readonly syncedAt: number;
};

/**
 * The settings rule of D16, for an acknowledgement and for a snapshot read. `sentAt` is the
 * `updatedAt` of the settings the batch carried (null for none). A local document that has not
 * changed since the batch was built is replaced by the server's; one that has stays and goes with
 * the next batch, so `syncedAt` stays below its `updatedAt`.
 */
export function settingsAfter(
  local: ValidSettings | null,
  syncedAt: number,
  sentAt: number | null,
  server: ValidSettings | null,
): SettingsAfter {
  const base = sentAt ?? syncedAt;
  if ((local?.updatedAt ?? 0) > base) return { replace: null, syncedAt: base };
  if (server === null) return { replace: null, syncedAt: base };
  const same = local !== null && local.updatedAt === server.updatedAt;
  return { replace: same ? null : server, syncedAt: server.updatedAt };
}
