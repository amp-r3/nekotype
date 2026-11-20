import type { Db, Write } from './idb';

/** The same interface over a Map: the fallback when IndexedDB is unavailable, and a test double. */
export function createMemoryDb(): Db {
  const data = new Map<string, unknown>();
  const id = (store: string, key: string) => `${store}\u0000${key}`;
  const applyToMap = (writes: readonly Write[]): void => {
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
  };
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
      applyToMap(writes);
      return Promise.resolve();
    },
    update: (reads, compute, scope = []) => {
      const allowed = new Set([...reads.map((r) => r.store), ...scope]);
      try {
        const writes = compute(reads.map((r) => data.get(id(r.store, r.key))));
        // All or none: a write outside the declared stores rejects before any is applied.
        if (writes.some((w) => !allowed.has(w.store))) throw new Error('write outside the scope');
        applyToMap(writes);
        return Promise.resolve();
      } catch (error) {
        return Promise.reject(error instanceof Error ? error : new Error('update failed'));
      }
    },
    hasStores: () => true,
    close: () => {},
  };
}
