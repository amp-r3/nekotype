/** A promise wrapper over the parts of IndexedDB the application uses. Values are `unknown`: callers narrow them with guards. */
export type Write =
  | { op: 'put'; store: string; key: string; value: unknown }
  | { op: 'delete'; store: string; key: string }
  | { op: 'clear'; store: string };

/** A store with indexes. An index is named after the property of the value it orders by. */
export interface StoreDef {
  name: string;
  indexes?: readonly string[];
}

export interface PageOptions {
  direction: 'next' | 'prev';
  offset: number;
  limit: number;
}

export interface Db {
  get(store: string, key: string): Promise<unknown>;
  put(store: string, key: string, value: unknown): Promise<void>;
  delete(store: string, key: string): Promise<void>;
  /** Applies the writes in one transaction over their stores: all of them or none. */
  write(writes: readonly Write[]): Promise<void>;
  /** Values of `store` in the order of `index` (ties by key); records without an indexable value are left out. */
  getPage(store: string, index: string, options: PageOptions): Promise<unknown[]>;
  count(store: string): Promise<number>;
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
        } else if (w.op === 'delete') {
          store.delete(w.key);
        } else {
          store.clear();
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
    getPage: (store, index, { direction, offset, limit }) =>
      new Promise((resolve, reject) => {
        const values: unknown[] = [];
        if (limit <= 0) {
          resolve(values);
          return;
        }
        const req = raw
          .transaction(store, 'readonly')
          .objectStore(store)
          .index(index)
          .openCursor(null, direction);
        let skipped = offset <= 0;
        req.onsuccess = () => {
          const cursor = req.result;
          if (!cursor) {
            resolve(values);
            return;
          }
          if (!skipped) {
            skipped = true;
            cursor.advance(offset);
            return;
          }
          values.push(cursor.value);
          if (values.length >= limit) resolve(values);
          else cursor.continue();
        };
        req.onerror = () => {
          reject(req.error ?? new Error('IndexedDB request failed'));
        };
      }),
    count: (store) => request(raw.transaction(store, 'readonly').objectStore(store).count()),
    hasStores: (names) => names.every((n) => raw.objectStoreNames.contains(n)),
    close: () => {
      raw.close();
    },
  };
}

/**
 * Opens `name` without a version, so the database is never refused for a lower one. A new database
 * gets the given stores, with their indexes, at version 1. A tab that holds the connection closes it on `versionchange`,
 * so another tab can delete or upgrade the database.
 */
export function openRaw(
  factory: IDBFactory,
  name: string,
  stores: readonly (string | StoreDef)[],
): Promise<OpenResult> {
  return new Promise((resolve, reject) => {
    const req = factory.open(name);
    let created = false;
    req.onupgradeneeded = (event) => {
      created = event.oldVersion === 0;
      for (const def of stores) {
        const { name, indexes = [] } = typeof def === 'string' ? { name: def } : def;
        if (req.result.objectStoreNames.contains(name)) continue;
        const store = req.result.createObjectStore(name);
        for (const index of indexes) store.createIndex(index, index);
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
  const indexable = (v: unknown): v is number | string =>
    typeof v === 'number' || typeof v === 'string';
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
        if (w.op === 'put') {
          data.set(id(w.store, w.key), w.value);
        } else if (w.op === 'delete') {
          data.delete(id(w.store, w.key));
        } else {
          const prefix = id(w.store, '');
          for (const k of [...data.keys()]) if (k.startsWith(prefix)) data.delete(k);
        }
      }
      return Promise.resolve();
    },
    getPage: (store, index, { direction, offset, limit }) => {
      const prefix = id(store, '');
      const rows: { key: string; at: number | string; value: unknown }[] = [];
      for (const [k, value] of data) {
        if (!k.startsWith(prefix) || typeof value !== 'object' || value === null) continue;
        const at: unknown = Reflect.get(value, index);
        if (indexable(at)) rows.push({ key: k, at, value });
      }
      const compare = (a: number | string, b: number | string): number =>
        typeof a === typeof b ? (a < b ? -1 : a > b ? 1 : 0) : typeof a === 'number' ? -1 : 1;
      rows.sort((a, b) => compare(a.at, b.at) || compare(a.key, b.key));
      if (direction === 'prev') rows.reverse();
      return Promise.resolve(
        rows
          .slice(Math.max(offset, 0), Math.max(offset, 0) + Math.max(limit, 0))
          .map((r) => r.value),
      );
    },
    count: (store) => {
      const prefix = id(store, '');
      let n = 0;
      for (const k of data.keys()) if (k.startsWith(prefix)) n += 1;
      return Promise.resolve(n);
    },
    hasStores: () => true,
    close: () => {},
  };
}
