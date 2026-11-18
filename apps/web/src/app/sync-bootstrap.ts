import { effect } from '@preact/signals';
import type { Db } from '@/shared/lib';
import { currentPath } from '@/shared/lib';
import { initUser, setAuthError, setSignInCheck, signInCheck, userId } from '@/entities/user';

/**
 * `auth_error` of the OAuth callback: shown on `/` until the next navigation, and removed from the
 * address at once (storage-sync.md, "Guest, sign-in and sign-out").
 */
function takeAuthError(): void {
  if (typeof location === 'undefined') return;
  const url = new URL(location.href);
  const error = url.searchParams.get('auth_error');
  if (error === null) return;
  url.searchParams.delete('auth_error');
  history.replaceState(history.state, '', `${url.pathname}${url.search}${url.hash}`);
  setAuthError(error === 'denied' ? 'denied' : 'failed');
  const shownOn = currentPath.value;
  const stop = effect(() => {
    if (currentPath.value === shownOn) return;
    setAuthError(null);
    queueMicrotask(() => {
      stop();
    });
  });
}

/**
 * Loads the user keys of `meta`; when a user is set or a sign-in redirect has just returned, loads
 * the sync chunk and checks the session with `GET /api/me` (D19). Once a user is signed in and the
 * check is done (here or in another tab, through the `nekotype:user` channel), starts the sync
 * engine (D17). A guest never loads the chunk of `features/sync`. `startSync` does nothing when it
 * already runs; signing out stops the engine from the account code of the same chunk.
 */
export function startSyncBootstrap(database: Promise<Db>): void {
  takeAuthError();
  void database.then(
    async (db) => {
      const returning = await initUser(db);
      if (userId.value !== null || returning) {
        // `m.checkAccount`, not a destructured parameter: Vite wraps a destructured dynamic import
        // in a function of its own, which costs initial bytes.
        await import('@/features/sync')
          .then((m) => m.checkAccount(db))
          .catch(() => {
            // The chunk did not load: the next start checks again.
            setSignInCheck('idle');
          });
      }
      effect(() => {
        if (userId.value === null || signInCheck.value !== 'idle') return;
        void import('@/features/sync').then((m) => {
          m.startSync(db);
        });
      });
    },
    () => {},
  );
}
