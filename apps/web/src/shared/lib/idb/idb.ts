/** A promise wrapper over the parts of IndexedDB the application uses. Values are `unknown`: callers narrow them with guards. */
export type Write =
  | { op: 'put'; store: string; key: string; value: unknown }
  | { op: 'delete'; store: string; key: string };

export interface Db {
  get(store: string, key: string): Promise<unknown>;
  put(store: string, key: string, value: unknown): Promise<void>;
  delete(store: string, key: string): Promise<void>;
  /** Applies the writes in one transaction over their stores: all of them or none. */
  write(writes: readonly Write[]): Promise<void>;
  hasStores(names: readonly string[]): boolean;
  close(): void;
}

export interface OpenResult {
  db: Db;
  /** True when this call created the database (there was none). */
  created: boolean;
}

function request<T>(req: IDBRequest<T>): Promise<T> {
  return new Promise((resolve, reject) => {
    req.onsuccess = () => {
      resolve(req.result);
    };
    req.onerror = () => {
      reject(req.error ?? new Error('IndexedDB request failed'));
    };
  });
}

function wrap(raw: IDBDatabase): Db {
  const run = (writes: readonly Write[]): Promise<void> => {
    const stores = [...new Set(writes.map((w) => w.store))];
    return new Promise((resolve, reject) => {
      // `transaction()` throws on a closed connection; the promise turns that into a rejection.
      const tx = raw.transaction(stores, 'readwrite');
      for (const w of writes) {
        const store = tx.objectStore(w.store);
        if (w.op === 'put') {
          store.put(w.value, w.key);
        } else {
          store.delete(w.key);
        }
      }
      tx.oncomplete = () => {
        resolve();
      };
      tx.onerror = () => {
        reject(tx.error ?? new Error('IndexedDB transaction failed'));
      };
      tx.onabort = () => {
        reject(tx.error ?? new Error('IndexedDB transaction aborted'));
      };
    });
  };

  return {
    get: async (store, key) =>
      request<unknown>(raw.transaction(store, 'readonly').objectStore(store).get(key)),
    put: (store, key, value) => run([{ op: 'put', store, key, value }]),
    delete: (store, key) => run([{ op: 'delete', store, key }]),
    write: (writes) => (writes.length === 0 ? Promise.resolve() : run(writes)),
    hasStores: (names) => names.every((n) => raw.objectStoreNames.contains(n)),
    close: () => {
      raw.close();
    },
  };
}

/**
 * Opens `name` without a version, so the database is never refused for a lower one. A new database
 * gets the given stores at version 1. A tab that holds the connection closes it on `versionchange`,
 * so another tab can delete or upgrade the database.
 */
export function openRaw(
  factory: IDBFactory,
  name: string,
  stores: readonly string[],
): Promise<OpenResult> {
  return new Promise((resolve, reject) => {
    const req = factory.open(name);
    let created = false;
    req.onupgradeneeded = (event) => {
      created = event.oldVersion === 0;
      for (const store of stores) {
        if (!req.result.objectStoreNames.contains(store)) {
          req.result.createObjectStore(store);
        }
      }
    };
    req.onblocked = () => {
      reject(new Error('IndexedDB open blocked'));
    };
    req.onerror = () => {
      reject(req.error ?? new Error('IndexedDB open failed'));
    };
    req.onsuccess = () => {
      const raw = req.result;
      raw.onversionchange = () => {
        raw.close();
      };
      resolve({ db: wrap(raw), created });
    };
  });
}

/** Deletes `name`. Rejects when another tab keeps a connection open, so a caller never waits for it. */
export function deleteRaw(factory: IDBFactory, name: string): Promise<void> {
  return new Promise((resolve, reject) => {
    const req = factory.deleteDatabase(name);
    req.onblocked = () => {
      reject(new Error('IndexedDB delete blocked'));
    };
    req.onerror = () => {
      reject(req.error ?? new Error('IndexedDB delete failed'));
    };
    req.onsuccess = () => {
      resolve();
    };
  });
}

/** The same interface over a Map: the fallback when IndexedDB is unavailable, and a test double. */
export function createMemoryDb(): Db {
  const data = new Map<string, unknown>();
  const id = (store: string, key: string) => `${store}\u0000${key}`;
  return {
    get: (store, key) => Promise.resolve(data.get(id(store, key))),
    put: (store, key, value) => {
      data.set(id(store, key), value);
      return Promise.resolve();
    },
    delete: (store, key) => {
      data.delete(id(store, key));
      return Promise.resolve();
    },
    write: (writes) => {
      for (const w of writes) {
        if (w.op === 'put') data.set(id(w.store, w.key), w.value);
        else data.delete(id(w.store, w.key));
      }
      return Promise.resolve();
    },
    hasStores: () => true,
    close: () => {},
  };
}
