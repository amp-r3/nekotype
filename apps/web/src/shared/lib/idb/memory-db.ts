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
      applyToMap(writes);
      return Promise.resolve();
    },
    getAll: (store, index) => {
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
      return Promise.resolve(rows.map((r) => r.value));
    },
    count: (store) => {
      const prefix = id(store, '');
      let n = 0;
      for (const k of data.keys()) if (k.startsWith(prefix)) n += 1;
      return Promise.resolve(n);
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
    getByIndex: (store, index, value, limit) => {
      const prefix = id(store, '');
      const rows: { key: string; value: unknown }[] = [];
      for (const [k, v] of data) {
        if (!k.startsWith(prefix) || typeof v !== 'object' || v === null) continue;
        if (Reflect.get(v, index) === value) rows.push({ key: k, value: v });
      }
      rows.sort((a, b) => (a.key < b.key ? -1 : a.key > b.key ? 1 : 0));
      return Promise.resolve(rows.slice(0, limit).map((r) => r.value));
    },
    hasStores: () => true,
    close: () => {},
  };
}
