import { effect } from '@preact/signals';
import type { Db } from '@/shared/lib';
import { initUser, userId } from '@/entities/user';

/**
 * Loads the user keys of `meta` and, once a user is signed in (here or in another tab, through the
 * `nekotype:user` channel), starts the sync engine (D17). A guest never loads the chunk of
 * `features/sync`. `startSync` does nothing when it already runs; signing out stops the engine
 * from the account code of the same chunk.
 */
export function startSyncBootstrap(database: Promise<Db>): void {
  void database.then(
    async (db) => {
      await initUser(db);
      effect(() => {
        if (userId.value === null) return;
        // `m.startSync`, not a destructured parameter: Vite wraps a destructured dynamic import
        // in a function of its own, which costs initial bytes.
        void import('@/features/sync').then((m) => {
          m.startSync(db);
        });
      });
    },
    () => {},
  );
}
