import { signal } from '@preact/signals';
import type { ReadonlySignal } from '@preact/signals';
import { deleteRaw, openRaw } from './idb';
import type { Db } from './idb';
import { DATABASE_NAME, SCHEMA_VERSION, STORES, STORE_NAMES } from './schema';

export type DatabaseMode = 'pending' | 'indexeddb' | 'memory';

const SCHEMA_KEY = 'schemaVersion';

async function schemaMatches(db: Db): Promise<boolean> {
  if (!db.hasStores(STORE_NAMES)) return false;
  try {
    return (await db.get('meta', SCHEMA_KEY)) === SCHEMA_VERSION;
  } catch {
    return false;
  }
}

/**
 * Opens the database. When a store is missing, `meta.schemaVersion` differs or `meta` cannot be
 * read, the database is deleted and created again (ADR 061). Rejects on any failure, including a
 * delete or an open that another tab blocks.
 */
export async function openDatabase(factory: IDBFactory): Promise<Db> {
  const first = await openRaw(factory, DATABASE_NAME, STORES);
  if (first.created) {
    await first.db.put('meta', SCHEMA_KEY, SCHEMA_VERSION);
    return first.db;
  }
  if (await schemaMatches(first.db)) return first.db;

  first.db.close();
  await deleteRaw(factory, DATABASE_NAME);
  const second = await openRaw(factory, DATABASE_NAME, STORES);
  await second.db.put('meta', SCHEMA_KEY, SCHEMA_VERSION);
  console.info('nekotype: local data reset (schema changed)');
  return second.db;
}

export interface DatabaseProvider {
  /**
   * One promise per page load. A failure to open resolves to the memory store; it rejects only when
   * the memory store's chunk cannot be loaded either (offline after a deploy replaced it).
   */
  getDatabase(): Promise<Db>;
  mode: ReadonlySignal<DatabaseMode>;
  /** A write failed after the database opened: what follows may not be saved. */
  failWrites(): void;
}

export function createDatabaseProvider(factory: IDBFactory | undefined): DatabaseProvider {
  const mode = signal<DatabaseMode>('pending');
  let opening: Promise<Db> | null = null;

  // The memory store is a chunk of its own: almost every page load opens IndexedDB.
  const fallback = async (): Promise<Db> => {
    mode.value = 'memory';
    const { createMemoryDb } = await import('./memory-db');
    return createMemoryDb();
  };

  return {
    mode,
    failWrites() {
      mode.value = 'memory';
    },
    getDatabase() {
      opening ??= (async () => {
        if (!factory) return fallback();
        try {
          const db = await openDatabase(factory);
          mode.value = 'indexeddb';
          return db;
        } catch {
          return fallback();
        }
      })();
      return opening;
    },
  };
}

const provider = createDatabaseProvider(typeof indexedDB === 'undefined' ? undefined : indexedDB);

/** The shared connection (or the memory store) for settings and learning. */
export function getDatabase(): Promise<Db> {
  return provider.getDatabase();
}

/** `memory` shows the "data will not be saved" notice. */
export const databaseMode: ReadonlySignal<DatabaseMode> = provider.mode;

/** A write failed after the database opened: what follows may not be saved, so the notice shows. */
export function reportWriteFailure(): void {
  provider.failWrites();
}
