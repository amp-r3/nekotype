import type { Clock, MeResponse } from '@nekotype/shared/types';
import { isObject } from '@nekotype/shared/runtime';
import type { FetchLike } from '@/shared/api';
import { apiFetch } from '@/shared/api';
import type { ChangeChannel, Db, Write } from '@/shared/lib';
import {
  DELTA_STORE,
  META_STORE,
  OUTBOX_STORE,
  SNAPSHOT_STORE,
  SYNC_KEY,
  uuidv7,
} from '@/shared/lib';
import type { AuthProvider, SignInCheck } from '@/entities/user';
import { isEmptyLearnChanges, isEmptyTypingChanges } from '../lib/build-batch';
import { readLearnChanges, readTypingChanges } from '../lib/stored';
import { readPendingSignIn, readProfile } from '../lib/profile';
import type { Profile } from '../lib/profile';

const RESULTS_STORE = 'results';

/** The stores that hold a user's data; sign-out and another account clear them (D19, Q3). */
const USER_STORES = [
  'results',
  DELTA_STORE,
  SNAPSHOT_STORE,
  OUTBOX_STORE,
  'records',
  'settings',
] as const;

/** The user keys of `meta`. `schemaVersion` and `typingIntervals` (the device's K) stay. */
const USER_META_KEYS = [
  'userId',
  'deviceId',
  'lastSeq',
  'snapshotVersion',
  'syncBlockedAtVersion',
  'sessionExpired',
  'settingsSyncedAt',
  'profile',
  'pendingSignIn',
] as const;

/** More unsynced results than any device holds: `getByIndex` needs a limit. */
const ALL = 1_000_000;

/** What the device holds that the server has not acknowledged. Settings do not count (ADR 089). */
export type Unsent = {
  /** Unsynced results. */
  readonly results: number;
  /** A batch in the outbox or a non-empty `delta` record. */
  readonly other: boolean;
};

export const hasUnsent = (unsent: Unsent): boolean => unsent.results > 0 || unsent.other;

/** The part of the sync engine the account code drives. */
export type EngineControl = {
  readonly syncNow: () => Promise<void>;
  readonly stop: () => void;
  readonly idle: () => Promise<void>;
};

export type AccountDeps = {
  readonly db: Db;
  readonly clock: Clock;
  readonly fetch: FetchLike;
  /** The stores listen on these; a `reset` makes them drop what they hold. */
  readonly channels: {
    readonly learn: ChangeChannel;
    readonly typing: ChangeChannel;
    readonly settings: ChangeChannel;
  };
  /** The user keys of `meta` changed: the signals read them again and the other tabs are told. */
  readonly refreshUser: () => Promise<void>;
  readonly setSignInCheck: (next: SignInCheck) => void;
  /** The engine of this tab, when it runs. */
  readonly engine: () => EngineControl | null;
};

export interface Account {
  /**
   * `GET /api/me` at the start (D19), and after a sign-in redirect has returned
   * (`meta.pendingSignIn`, which names the provider). Resolves when the outcome is stored; with another account and unsent data it leaves
   * `signInCheck` at `choice` and waits for `resolveAnotherAccount`.
   */
  check: () => Promise<void>;
  /** The choice of the "another account" dialog (design decision 118). */
  resolveAnotherAccount: (choice: 'cancel' | 'discard') => Promise<void>;
  /** What sign-out would lose; with a valid session a sync runs first. */
  prepareSignOut: () => Promise<Unsent>;
  /**
   * Deletes the session on the server (not with an expired session: it has none) and clears the
   * user's data. False when the server could not be reached: nothing is cleared.
   */
  signOut: () => Promise<boolean>;
  /**
   * `DELETE /api/me`, then the same clearing as sign-out. False when the server did not confirm
   * (offline, `401`, a failure): nothing is cleared (ADR 079).
   */
  deleteAccount: () => Promise<boolean>;
}

function isMeResponse(value: unknown): value is MeResponse {
  return (
    isObject(value) &&
    typeof value['id'] === 'string' &&
    (value['email'] === null || typeof value['email'] === 'string') &&
    (value['displayName'] === null || typeof value['displayName'] === 'string')
  );
}

const metaPut = (key: string, value: unknown): Write => ({
  op: 'put',
  store: META_STORE,
  key,
  value,
});
const metaDelete = (key: string): Write => ({ op: 'delete', store: META_STORE, key });

export function createAccount(deps: AccountDeps): Account {
  const { db } = deps;
  // The account the dialog asks about.
  let waiting: { readonly me: MeResponse; readonly provider: AuthProvider | null } | null = null;

  const unsent = async (): Promise<Unsent> => {
    const [outbox, learn, typing, results] = await Promise.all([
      db.get(OUTBOX_STORE, SYNC_KEY),
      db.get(DELTA_STORE, 'learn'),
      db.get(DELTA_STORE, 'typing'),
      db.getByIndex(RESULTS_STORE, 'synced', 0, ALL),
    ]);
    const learnChanges = readLearnChanges(learn);
    const typingChanges = readTypingChanges(typing);
    return {
      results: results.length,
      other:
        outbox !== undefined ||
        (learnChanges !== null && !isEmptyLearnChanges(learnChanges)) ||
        (typingChanges !== null && !isEmptyTypingChanges(typingChanges)),
    };
  };

  const profileOf = (me: MeResponse, provider: AuthProvider): Profile => ({
    displayName: me.displayName,
    email: me.email,
    provider,
  });

  /** The keys of a user who starts on this device: a new device id, nothing sent yet. */
  const newUserWrites = (me: MeResponse, provider: AuthProvider | null): Write[] => [
    metaPut('userId', me.id),
    metaPut('deviceId', uuidv7(deps.clock.now())),
    metaPut('lastSeq', 0),
    provider === null ? metaDelete('profile') : metaPut('profile', profileOf(me, provider)),
    metaDelete('sessionExpired'),
    metaDelete('pendingSignIn'),
  ];

  /** Every user store and user key cleared, plus `extra`, in one transaction; the stores drop their views. */
  const clearUserData = async (extra: readonly Write[]): Promise<void> => {
    await db.write([
      ...USER_STORES.map((store): Write => ({ op: 'clear', store })),
      ...USER_META_KEYS.map(metaDelete),
      ...extra,
    ]);
    deps.channels.learn.post('reset');
    deps.channels.typing.post('reset');
    deps.channels.settings.post('reset');
    await deps.refreshUser();
  };

  const finish = async (writes: readonly Write[]): Promise<void> => {
    if (writes.length > 0) await db.write(writes);
    await deps.refreshUser();
    deps.setSignInCheck('idle');
  };

  return {
    async check() {
      const [storedUser, storedProfile, storedPending] = await Promise.all([
        db.get(META_STORE, 'userId'),
        db.get(META_STORE, 'profile'),
        db.get(META_STORE, 'pendingSignIn'),
      ]);
      const pending = readPendingSignIn(storedPending);
      const current = typeof storedUser === 'string' ? storedUser : null;
      const result = await apiFetch('/api/me', {}, deps.fetch);

      if (result.kind === 'error' && result.status === 401) {
        // An abandoned sign-in leaves a guest a guest; a signed-in user keeps the data (A27).
        await finish(
          current === null
            ? [metaDelete('pendingSignIn')]
            : [metaPut('sessionExpired', true), metaDelete('pendingSignIn')],
        );
        return;
      }
      if (result.kind !== 'ok' || !isMeResponse(result.body)) {
        // No answer: the next start asks again.
        deps.setSignInCheck('idle');
        return;
      }
      const me = result.body;
      const provider = pending ?? readProfile(storedProfile)?.provider ?? null;

      if (current === null) {
        // Guest merge: the guest's delta and results go in the first batches.
        await finish(newUserWrites(me, provider));
        return;
      }
      if (me.id === current) {
        // The same user: the device id, `lastSeq`, the outbox and the delta are kept.
        await finish([
          metaDelete('sessionExpired'),
          metaDelete('pendingSignIn'),
          ...(provider === null ? [] : [metaPut('profile', profileOf(me, provider))]),
        ]);
        return;
      }
      // Another user: the previous account's unsent data must not reach this one.
      if (hasUnsent(await unsent())) {
        waiting = { me, provider };
        deps.setSignInCheck('choice');
        return;
      }
      await clearUserData(newUserWrites(me, provider));
      deps.setSignInCheck('idle');
    },

    async resolveAnotherAccount(choice) {
      const next = waiting;
      if (next === null) return;
      waiting = null;
      if (choice === 'discard') {
        await clearUserData(newUserWrites(next.me, next.provider));
        deps.setSignInCheck('idle');
        return;
      }
      // Cancel: the new session is deleted. Its cookie replaced the previous one, so the previous
      // user's session is gone on this device too.
      await apiFetch('/api/auth/logout', { method: 'POST' }, deps.fetch);
      await finish([metaPut('sessionExpired', true), metaDelete('pendingSignIn')]);
    },

    async prepareSignOut() {
      const expired = (await db.get(META_STORE, 'sessionExpired')) === true;
      if (!expired) await deps.engine()?.syncNow();
      return unsent();
    },

    async signOut() {
      const expired = (await db.get(META_STORE, 'sessionExpired')) === true;
      if (!expired) {
        const result = await apiFetch('/api/auth/logout', { method: 'POST' }, deps.fetch);
        // The session must be gone on the server before the device lets go of it (ADR 079).
        if (result.kind === 'network' || (result.kind === 'error' && result.status !== 401)) {
          return false;
        }
      }
      const engine = deps.engine();
      engine?.stop();
      await engine?.idle();
      await clearUserData([]);
      return true;
    },

    async deleteAccount() {
      const result = await apiFetch('/api/me', { method: 'DELETE' }, deps.fetch);
      // Only the server's `204` counts: the account is gone there, and so is the session.
      if (result.kind !== 'ok') return false;
      const engine = deps.engine();
      engine?.stop();
      await engine?.idle();
      await clearUserData([]);
      return true;
    },
  };
}
