import type { JSX } from 'preact';
import { useRef, useState } from 'preact/hooks';
import { t, tPlural } from '@/shared/i18n';
import { Button, Dialog, Notice } from '@/shared/ui';
import { CatMark } from '@/shared/ui/cat-mark';
import { beginSignIn, sessionExpired, storedProfile } from '@/entities/user';
import {
  deleteAccount,
  prepareSignOut,
  readProfile,
  signOut,
  syncOnline,
  syncStatus,
} from '@/features/sync';
import type { Profile, SyncStatus, Unsent } from '@/features/sync';

const STATUS_KEYS = {
  synced: 'settings.sync.synced',
  pending: 'settings.sync.pending',
  offline: 'settings.sync.offline',
  expired: 'settings.sync.expired',
  blocked: 'settings.sync.blocked',
} as const satisfies Record<SyncStatus, string>;

// The name line: the display name, else the email, else "account" (design decision 123).
function nameOf(user: Profile | null): string {
  return user?.displayName ?? user?.email ?? t('settings.account.noName');
}

// What the sign-out dialog names: the unsent results, or that some progress waits (ADR 089).
function lossText(unsent: Unsent): string {
  return unsent.results > 0 ? tPlural('signOut.results', unsent.results) : t('signOut.progress');
}

/**
 * The account section of `/settings` for a signed-in user: a lazy chunk with the sync engine. The
 * profile, the sync status (with `sign in again` while the session is expired), sign-out, which
 * needs a connection unless the session has expired, and account deletion, which needs a valid
 * session (design decisions 121–123).
 */
export function AccountPanel(): JSX.Element {
  const status = syncStatus.value;
  const user = readProfile(storedProfile.value);
  const expired = sessionExpired.value;
  const needsConnection = !expired && !syncOnline.value;
  const [busy, setBusy] = useState(false);
  const [loss, setLoss] = useState<Unsent | null>(null);
  const cancelRef = useRef<HTMLButtonElement | null>(null);
  const [deleting, setDeleting] = useState(false);
  const [word, setWord] = useState('');
  const [deleteBusy, setDeleteBusy] = useState(false);
  const [deleteFailed, setDeleteFailed] = useState(false);
  const deleteCancelRef = useRef<HTMLButtonElement | null>(null);
  const wordMatches = word.trim().toLowerCase() === t('delete.word');

  const finish = async (): Promise<void> => {
    setBusy(true);
    const done = await signOut();
    // On success the section is replaced by the guest form; otherwise the status says why.
    if (!done) setBusy(false);
    setLoss(null);
  };

  const start = async (): Promise<void> => {
    setBusy(true);
    const unsent = await prepareSignOut();
    if (unsent.results > 0 || unsent.other) {
      setBusy(false);
      setLoss(unsent);
      return;
    }
    await finish();
  };

  const openDelete = (): void => {
    setWord('');
    setDeleteFailed(false);
    setDeleting(true);
  };

  const confirmDelete = async (): Promise<void> => {
    setDeleteBusy(true);
    setDeleteFailed(false);
    const done = await deleteAccount();
    // On success the section is replaced by the guest form; a failure keeps the typed word.
    if (!done) {
      setDeleteBusy(false);
      setDeleteFailed(true);
      return;
    }
    setDeleting(false);
  };

  const caption = expired
    ? t('settings.account.signInToDelete')
    : needsConnection
      ? t('settings.account.needsConnection')
      : '';

  return (
    <section className="flex flex-col gap-6">
      <h2 className="text-ui-heading text-fur">{t('settings.account.title')}</h2>

      <div className="flex items-center gap-4">
        <CatMark size={40} className="flex-none" />
        <div className="flex min-w-0 flex-col">
          <span className="text-ui-label text-fur break-all" data-testid="account-name">
            {nameOf(user)}
          </span>
          {user !== null && (
            <span className="text-ui-caption text-fur-dim">
              {t(
                user.provider === 'google'
                  ? 'settings.account.viaGoogle'
                  : 'settings.account.viaGithub',
              )}
            </span>
          )}
        </div>
      </div>

      <div className="flex w-full items-center justify-between gap-6 max-sm:flex-col max-sm:items-start max-sm:gap-3">
        <span className="text-ui-label text-fur">{t('settings.account.sync')}</span>
        <Notice
          tone={status === 'blocked' ? 'miss' : undefined}
          action={
            status === 'expired' && user !== null ? (
              <Button
                variant="secondary"
                size="sm"
                onClick={() => {
                  void beginSignIn(user.provider);
                }}
              >
                {t('settings.account.signInAgain')}
              </Button>
            ) : undefined
          }
        >
          {t(STATUS_KEYS[status])}
        </Notice>
      </div>

      <div className="flex flex-col items-start gap-2">
        <div className="flex flex-wrap items-center gap-3">
          <Button
            variant="secondary"
            disabled={busy || needsConnection}
            onClick={() => {
              void start();
            }}
          >
            {t('settings.account.signOut')}
          </Button>
          <Button
            variant="danger"
            disabled={busy || needsConnection || expired}
            onClick={openDelete}
          >
            {t('settings.account.delete')}
          </Button>
        </div>
        {/* The line's place is reserved (design decision 121). */}
        <p className="text-ui-caption text-fur-dim min-h-4">{caption}</p>
      </div>

      <Dialog
        open={loss !== null}
        onClose={() => {
          setLoss(null);
        }}
        title={t('signOut.title')}
        closeLabel={t('signOut.cancel')}
        initialFocusRef={cancelRef}
      >
        <p className="text-fur-dim text-ui-body">{loss === null ? '' : lossText(loss)}</p>
        <div className="flex flex-wrap items-center justify-end gap-2 pt-2">
          <Button
            variant="text"
            buttonRef={cancelRef}
            disabled={busy}
            onClick={() => {
              setLoss(null);
            }}
          >
            {t('signOut.cancel')}
          </Button>
          <Button
            variant="danger"
            disabled={busy}
            onClick={() => {
              void finish();
            }}
          >
            {t('signOut.action')}
          </Button>
        </div>
      </Dialog>
      <Dialog
        open={deleting}
        onClose={
          deleteBusy
            ? undefined
            : () => {
                setDeleting(false);
              }
        }
        title={t('delete.title')}
        closeLabel={t('signOut.cancel')}
        initialFocusRef={deleteCancelRef}
        note={deleteFailed ? <Notice tone="miss">{t('delete.failed')}</Notice> : undefined}
        actions={
          <>
            <Button
              variant="text"
              buttonRef={deleteCancelRef}
              disabled={deleteBusy}
              onClick={() => {
                setDeleting(false);
              }}
            >
              {t('delete.cancel')}
            </Button>
            <Button
              variant="danger"
              disabled={deleteBusy || !wordMatches}
              onClick={() => {
                void confirmDelete();
              }}
            >
              {deleteBusy ? t('delete.busy') : t('delete.action')}
            </Button>
          </>
        }
      >
        <label className="flex flex-col gap-2">
          <span className="text-ui-label text-fur-dim">{t('delete.label')}</span>
          <input
            type="text"
            value={word}
            disabled={deleteBusy}
            autoComplete="off"
            autoCapitalize="off"
            autoCorrect="off"
            spellcheck={false}
            data-testid="delete-word"
            onInput={(event) => {
              setWord(event.currentTarget.value);
            }}
            className="bg-bg text-ui-body text-fur caret-eye placeholder:text-fur-dim disabled:text-fur-faint h-control pointer-coarse:min-h-touch-min disabled:border-line w-full rounded-sm border border-transparent px-3 disabled:bg-transparent"
          />
        </label>
      </Dialog>
    </section>
  );
}
