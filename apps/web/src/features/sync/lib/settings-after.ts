import type { ValidSettings } from '@nekotype/shared/types';

export type SettingsAfter = {
  /** The document to store in place of the local one, or null to keep it. */
  readonly replace: ValidSettings | null;
  /** The new `meta.settingsSyncedAt`. */
  readonly syncedAt: number;
};

/**
 * The settings rule of storage-sync.md ("Settings travel"), for an acknowledgement and for a pulled
 * page. `sentAt` is the `updatedAt` of the settings the batch carried (null for none). A local
 * document that has not changed since the batch was built is replaced by the server's; one that has
 * stays and goes with the next batch, so `syncedAt` stays below its `updatedAt`.
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
