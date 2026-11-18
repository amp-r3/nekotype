import type { JSX } from 'preact';
import { t } from '@/shared/i18n';
import { Notice } from '@/shared/ui';
import { syncStatus } from '@/features/sync';
import type { SyncStatus } from '@/features/sync';

const STATUS_KEYS = {
  synced: 'settings.sync.synced',
  pending: 'settings.sync.pending',
  offline: 'settings.sync.offline',
  expired: 'settings.sync.expired',
  blocked: 'settings.sync.blocked',
} as const satisfies Record<SyncStatus, string>;

/**
 * The account section of `/settings`: a lazy chunk, loaded when a user is signed in. It shows the
 * sync status only; PR 8 adds the profile, sign-out and account deletion.
 */
export function AccountPanel(): JSX.Element {
  const status = syncStatus.value;
  return (
    <section className="flex flex-col gap-6">
      <h2 className="text-ui-heading text-fur">{t('settings.account.title')}</h2>
      <Notice tone={status === 'blocked' ? 'miss' : undefined}>{t(STATUS_KEYS[status])}</Notice>
    </section>
  );
}
