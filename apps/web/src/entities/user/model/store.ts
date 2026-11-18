import { signal } from '@preact/signals';
import type { ReadonlySignal } from '@preact/signals';
import type { Db } from '@/shared/lib';
import { META_STORE, changeChannel } from '@/shared/lib';

const _userId = signal<string | null>(null);

/** `meta.userId`: set while a user is signed in on this device, an expired session included. */
export const userId: ReadonlySignal<string | null> = _userId;

let boundDb: Db | null = null;
const channel = changeChannel('nekotype:user');

// Never rejects: an unreadable database leaves the signal as it is (a guest at the start).
async function read(db: Db): Promise<void> {
  try {
    const id = await db.get(META_STORE, 'userId');
    _userId.value = typeof id === 'string' ? id : null;
  } catch {
    // Unreadable.
  }
}

/** Reads `meta.userId` and follows the other tabs. */
export async function initUser(db: Db): Promise<void> {
  boundDb = db;
  channel.listen(() => {
    void read(db);
  });
  await read(db);
}

/** The sync or the account code changed the user keys of `meta`: read them and tell the other tabs. */
export async function refreshUser(): Promise<void> {
  if (boundDb === null) return;
  await read(boundDb);
  channel.post();
}
