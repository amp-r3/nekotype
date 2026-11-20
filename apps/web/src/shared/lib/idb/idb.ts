/** A promise wrapper over the parts of IndexedDB the application uses. Values are `unknown`: callers narrow them with guards. */
export type Write =
  | { op: 'put'; store: string; key: string; value: unknown }
  | { op: 'delete'; store: string; key: string }
  | { op: 'clear'; store: string };

/** A store of the database. */
export interface StoreDef {
  name: string;
}

/** A record to read inside an `update` transaction. */
export type Read = { store: string; key: string };

export interface Db {
  get(store: string, key: string): Promise<unknown>;
  put(store: string, key: string, value: unknown): Promise<void>;
  delete(store: string, key: string): Promise<void>;
  /** Applies the writes in one transaction over their stores: all of them or none. */
  write(writes: readonly Write[]): Promise<void>;
  /**
   * A read-modify-write in one `readwrite` transaction (D15): reads the records, hands their values
   * (`undefined` for a missing one, in the order of `reads`) to the synchronous `compute` and
   * applies the writes it returns. `scope` names stores the writes touch that are not read. A
   * `compute` that throws, or a write outside the stores of `reads` and `scope`, aborts the
   * transaction and rejects.
   */
  update(
    reads: readonly Read[],
    compute: (values: readonly unknown[]) => readonly Write[],
    scope?: readonly string[],
  ): Promise<void>;
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

function applyWrites(tx: IDBTransaction, writes: readonly Write[]): void {
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
}

function wrap(raw: IDBDatabase): Db {
  const run = (writes: readonly Write[]): Promise<void> => {
    const stores = [...new Set(writes.map((w) => w.store))];
    return new Promise((resolve, reject) => {
      // `transaction()` throws on a closed connection; the promise turns that into a rejection.
      const tx = raw.transaction(stores, 'readwrite');
      applyWrites(tx, writes);
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
    update: (reads, compute, scope = []) =>
      new Promise((resolve, reject) => {
        const stores = [...new Set([...reads.map((r) => r.store), ...scope])];
        if (stores.length === 0) {
          // A transaction needs a store; with none, there is nothing to read or write.
          resolve();
          return;
        }
        const tx = raw.transaction(stores, 'readwrite');
        tx.oncomplete = () => {
          resolve();
        };
        tx.onerror = () => {
          reject(tx.error ?? new Error('IndexedDB transaction failed'));
        };
        tx.onabort = () => {
          reject(tx.error ?? new Error('IndexedDB transaction aborted'));
        };
        const values: unknown[] = new Array<unknown>(reads.length).fill(undefined);
        let waiting = reads.length;
        const finish = (): void => {
          try {
            applyWrites(tx, compute(values));
          } catch (error) {
            // `abort` fires `onabort`, which rejects with the transaction's error; keep ours.
            reject(error instanceof Error ? error : new Error('IndexedDB update failed'));
            tx.abort();
          }
        };
        if (waiting === 0) {
          finish();
          return;
        }
        reads.forEach((read, i) => {
          const req = tx.objectStore(read.store).get(read.key);
          req.onsuccess = () => {
            values[i] = req.result;
            waiting -= 1;
            if (waiting === 0) finish();
          };
        });
      }),
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
  stores: readonly (string | StoreDef)[],
): Promise<OpenResult> {
  return new Promise((resolve, reject) => {
    const req = factory.open(name);
    let created = false;
    req.onupgradeneeded = (event) => {
      created = event.oldVersion === 0;
      for (const def of stores) {
        const { name } = typeof def === 'string' ? { name: def } : def;
        if (req.result.objectStoreNames.contains(name)) continue;
        req.result.createObjectStore(name);
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
