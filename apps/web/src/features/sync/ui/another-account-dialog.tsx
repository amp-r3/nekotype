import type { JSX } from 'preact';
import { useRef, useState } from 'preact/hooks';
import { t } from '@/shared/i18n';
import { Button, Dialog } from '@/shared/ui';
import { resolveAnotherAccount } from '../model/runtime';

/**
 * A sign-in returned as another user while the device holds the previous account's unsent data
 * (design decision 118). `cancel`, `Esc` and `✕` delete the new session; `discard and continue`
 * clears the device for the new account. Shown on `/`, which stays in its loading state meanwhile.
 */
export function AnotherAccountDialog(): JSX.Element {
  const [busy, setBusy] = useState(false);
  const cancelRef = useRef<HTMLButtonElement | null>(null);
  const choose = (choice: 'cancel' | 'discard'): void => {
    if (busy) return;
    setBusy(true);
    void resolveAnotherAccount(choice);
  };
  return (
    <Dialog
      open
      onClose={() => {
        choose('cancel');
      }}
      title={t('account.other.title')}
      closeLabel={t('account.other.cancel')}
      initialFocusRef={cancelRef}
    >
      <p className="text-fur-dim text-ui-body">{t('account.other.text')}</p>
      <div className="flex flex-wrap items-center justify-end gap-2 pt-2">
        <Button
          variant="text"
          buttonRef={cancelRef}
          disabled={busy}
          onClick={() => {
            choose('cancel');
          }}
        >
          {t('account.other.cancel')}
        </Button>
        <Button
          variant="danger"
          disabled={busy}
          onClick={() => {
            choose('discard');
          }}
        >
          {t('account.other.discard')}
        </Button>
      </div>
    </Dialog>
  );
}
