import type { ChangeChannel, Db, SyncReason } from '@/shared/lib';
import { changeChannel, defaultClock, defaultScheduler, onSyncRequest } from '@/shared/lib';
import { refreshUser, setSignInCheck } from '@/entities/user';
import { createAccount } from './account';
import type { Account, Unsent } from './account';
import { createSyncEngine } from './engine';
import type { SyncEngine, SyncEnv, SyncLocks } from './engine';

const LOCK_NAME = 'nekotype-sync';

/** The Web Lock `nekotype-sync`; without the API, a mutex of this tab (D17). */
function createLocks(): SyncLocks {
  const manager = typeof navigator === 'undefined' ? undefined : navigator.locks;
  if (manager !== undefined) {
    return {
      run: (job) => manager.request(LOCK_NAME, job),
      tryRun: (job) =>
        manager.request(LOCK_NAME, { ifAvailable: true }, (lock) =>
          lock === null ? Promise.resolve(null) : job(),
        ),
    };
  }
  let tail: Promise<unknown> = Promise.resolve();
  let busy = false;
  const run = <T>(job: () => Promise<T>): Promise<T> => {
    const result = tail.then(async () => {
      busy = true;
      try {
        return await job();
      } finally {
        busy = false;
      }
    });
    tail = result.catch(() => {});
    return result;
  };
  return { run, tryRun: (job) => (busy ? Promise.resolve(null) : run(job)) };
}

function createEnv(): SyncEnv {
  const listen = (target: EventTarget, type: string, handler: () => void): (() => void) => {
    target.addEventListener(type, handler);
    return () => {
      target.removeEventListener(type, handler);
    };
  };
  return {
    isOnline: () => navigator.onLine,
    onOnline: (handler) => listen(window, 'online', handler),
    onOffline: (handler) => listen(window, 'offline', handler),
    onHidden: (handler) =>
      listen(document, 'visibilitychange', () => {
        if (document.visibilityState === 'hidden') handler();
      }),
  };
}

let engine: SyncEngine | null = null;
let channels: SyncEngineChannels | null = null;
let account: Account | null = null;

type SyncEngineChannels = {
  readonly learn: ChangeChannel;
  readonly typing: ChangeChannel;
  readonly settings: ChangeChannel;
};

// One set of channel objects for the chunk: the stores of this tab receive their posts too (D17).
function syncChannels(): SyncEngineChannels {
  channels ??= {
    learn: changeChannel('nekotype:learn'),
    typing: changeChannel('nekotype:typing'),
    settings: changeChannel('nekotype:settings'),
  };
  return channels;
}

function accountOf(db: Db): Account {
  account ??= createAccount({
    db,
    clock: defaultClock,
    fetch: (input, init) => fetch(input, init),
    channels: syncChannels(),
    refreshUser,
    setSignInCheck,
    engine: () => engine,
  });
  return account;
}

/** `GET /api/me` at the start, when a user is set or a sign-in redirect has just returned (D19). */
export function checkAccount(db: Db): Promise<void> {
  return accountOf(db).check();
}

/** The choice of the "another account" dialog. */
export function resolveAnotherAccount(choice: 'cancel' | 'discard'): Promise<void> {
  return account?.resolveAnotherAccount(choice) ?? Promise.resolve();
}

/** Syncs when it can, then says what sign-out would lose. */
export function prepareSignOut(): Promise<Unsent> {
  return account?.prepareSignOut() ?? Promise.resolve({ results: 0, other: false });
}

/** Signs out; false when the server could not be reached and nothing changed. */
export function signOut(): Promise<boolean> {
  return account?.signOut() ?? Promise.resolve(false);
}

/** Starts the engine of this tab on `db`; a second call does nothing. Called when a user is signed in. */
export function startSync(db: Db): void {
  accountOf(db);
  engine ??= createSyncEngine({
    db,
    clock: defaultClock,
    scheduler: defaultScheduler,
    fetch: (input, init) => fetch(input, init),
    appVersion: __APP_VERSION__,
    locks: createLocks(),
    env: createEnv(),
    channels: syncChannels(),
    refreshUser,
    onSyncRequest: (handler: (reason: SyncReason) => void) => onSyncRequest(handler),
  });
  engine.start();
}

/** Stops triggering: the user signed out. */
export function stopSync(): void {
  engine?.stop();
}
