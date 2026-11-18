import { signal } from '@preact/signals';
import type { ReadonlySignal } from '@preact/signals';
import type { Db } from '@/shared/lib';
import { META_STORE, changeChannel } from '@/shared/lib';

export type AuthProvider = 'google' | 'github';

/** `auth_error` of the OAuth callback (storage-sync.md, "Guest, sign-in and sign-out"). */
export type AuthError = 'denied' | 'failed';

/**
 * The check of `GET /api/me` at the start: `idle` (none or done), `checking` (a sign-in redirect has
 * just returned and the answer is awaited), `choice` (another account with unsent data: the dialog of
 * design decision 118 waits). `/` shows its loading state while it is not `idle`.
 */
export type SignInCheck = 'idle' | 'checking' | 'choice';

const _userId = signal<string | null>(null);
const _sessionExpired = signal(false);
const _profile = signal<unknown>(null);
const _authError = signal<AuthError | null>(null);
const _authAvailable = signal(false);
const _signInCheck = signal<SignInCheck>('idle');

/** `meta.userId`: set while a user is signed in on this device, an expired session included. */
export const userId: ReadonlySignal<string | null> = _userId;
/** `meta.sessionExpired`: the server answered `401`; the data stays and syncing stops. */
export const sessionExpired: ReadonlySignal<boolean> = _sessionExpired;
/**
 * `meta.profile` as stored, unchecked: the account panel, a lazy chunk, reads it (`readProfile` of
 * `features/sync`), so its parsing stays out of the initial chunk.
 */
export const storedProfile: ReadonlySignal<unknown> = _profile;
/** A sign-in that did not finish; shown on `/` until the next navigation. */
export const authError: ReadonlySignal<AuthError | null> = _authError;
/** Sign-in is offered on this host (p5-plan.md, D20): never on a preview. */
export const authAvailable: ReadonlySignal<boolean> = _authAvailable;
export const signInCheck: ReadonlySignal<SignInCheck> = _signInCheck;

/** The hosts where the OAuth clients accept a redirect (D20). */
const AUTH_HOSTS: readonly string[] = ['nekotype.pages.dev', 'localhost', '127.0.0.1'];

export function isAuthHost(host: string): boolean {
  return AUTH_HOSTS.includes(host);
}

let boundDb: Db | null = null;

const channel = changeChannel('nekotype:user');

// Never rejects: an unreadable database leaves the signals as they are (a guest at the start).
async function read(db: Db): Promise<{ returning: boolean }> {
  try {
    const [id, expired, stored, pending] = await Promise.all([
      db.get(META_STORE, 'userId'),
      db.get(META_STORE, 'sessionExpired'),
      db.get(META_STORE, 'profile'),
      db.get(META_STORE, 'pendingSignIn'),
    ]);
    _userId.value = typeof id === 'string' ? id : null;
    _sessionExpired.value = _userId.value !== null && expired === true;
    _profile.value = _userId.value === null ? null : stored;
    return { returning: pending !== undefined };
  } catch {
    return { returning: false };
  }
}

/**
 * Reads the user keys of `meta` and follows the other tabs. `host` decides whether sign-in is
 * offered (D20). Resolves true when a sign-in redirect has just returned (`meta.pendingSignIn`): the
 * caller then checks `GET /api/me` (D19).
 */
export async function initUser(
  db: Db,
  host: string = typeof location === 'undefined' ? '' : location.hostname,
): Promise<boolean> {
  boundDb = db;
  _authAvailable.value = isAuthHost(host);
  channel.listen(() => {
    void read(db);
  });
  const { returning } = await read(db);
  if (returning) _signInCheck.value = 'checking';
  return returning;
}

/** The sync or the account code changed the user keys of `meta`: read them and tell the other tabs. */
export async function refreshUser(): Promise<void> {
  if (boundDb === null) return;
  await read(boundDb);
  channel.post();
}

/**
 * Leaves for the OAuth flow of `provider`. `meta.pendingSignIn` is written first: at the next start
 * its presence means "a sign-in redirect has just returned" (D19). `go` is the navigation (tests).
 */
export async function beginSignIn(
  provider: AuthProvider,
  go: (url: string) => void = (url) => {
    location.assign(url);
  },
): Promise<void> {
  if (boundDb !== null) {
    try {
      await boundDb.put(META_STORE, 'pendingSignIn', { provider });
    } catch {
      // Unwritable: the return is then seen only through `meta.userId`; sign in anyway.
    }
  }
  go(`/api/auth/${provider}`);
}

export function setAuthError(error: AuthError | null): void {
  _authError.value = error;
}

export function setSignInCheck(next: SignInCheck): void {
  _signInCheck.value = next;
}
