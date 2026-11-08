import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import type { MockInstance } from 'vitest';
import { IDBFactory } from 'fake-indexeddb';
import { createDatabaseProvider, openDatabase } from './database';
import { openRaw, deleteRaw } from './idb';
import { DATABASE_NAME, SCHEMA_VERSION, STORES } from './schema';

class FailingFactory extends IDBFactory {
  override open(): IDBOpenDBRequest {
    throw new Error('refused');
  }
}

/** A second "tab": a connection that never closes on versionchange, with another schema version. */
function holdStaleConnection(factory: IDBFactory): Promise<void> {
  return new Promise((resolve, reject) => {
    const req = factory.open(DATABASE_NAME);
    req.onupgradeneeded = () => {
      for (const name of STORES) req.result.createObjectStore(name);
    };
    req.onerror = () => {
      reject(req.error ?? new Error('open failed'));
    };
    req.onsuccess = () => {
      const tx = req.result.transaction('meta', 'readwrite');
      tx.objectStore('meta').put(SCHEMA_VERSION + 1, 'schemaVersion');
      tx.oncomplete = () => {
        resolve();
      };
    };
  });
}

describe('openDatabase', () => {
  let factory: IDBFactory;
  let info: MockInstance<typeof console.info>;

  beforeEach(() => {
    factory = new IDBFactory();
    info = vi.spyOn(console, 'info').mockImplementation(() => {});
  });
  afterEach(() => {
    vi.restoreAllMocks();
  });

  it('creates a new database silently and writes the schema version', async () => {
    const db = await openDatabase(factory);
    expect(db.hasStores(STORES)).toBe(true);
    expect(await db.get('meta', 'schemaVersion')).toBe(SCHEMA_VERSION);
    expect(info).not.toHaveBeenCalled();
  });

  it('keeps the data when the schema matches', async () => {
    const first = await openDatabase(factory);
    await first.put('settings', 'current', { a: 1 });
    first.close();
    const second = await openDatabase(factory);
    expect(await second.get('settings', 'current')).toEqual({ a: 1 });
  });

  it('resets a database with another schemaVersion', async () => {
    const first = await openDatabase(factory);
    await first.put('settings', 'current', { a: 1 });
    await first.put('meta', 'schemaVersion', SCHEMA_VERSION + 1);
    first.close();
    const second = await openDatabase(factory);
    expect(await second.get('settings', 'current')).toBeUndefined();
    expect(await second.get('meta', 'schemaVersion')).toBe(SCHEMA_VERSION);
    expect(info).toHaveBeenCalledTimes(1);
  });

  it('resets a database with a missing store', async () => {
    const old = await openRaw(factory, DATABASE_NAME, ['settings', 'meta']);
    await old.db.put('meta', 'schemaVersion', SCHEMA_VERSION);
    old.db.close();
    const db = await openDatabase(factory);
    expect(db.hasStores(STORES)).toBe(true);
    expect(info).toHaveBeenCalledTimes(1);
  });

  it('resets a database whose meta cannot be read', async () => {
    const first = await openDatabase(factory);
    first.close();
    const bad = await openRaw(factory, DATABASE_NAME, STORES);
    await bad.db.delete('meta', 'schemaVersion');
    bad.db.close();
    const db = await openDatabase(factory);
    expect(await db.get('meta', 'schemaVersion')).toBe(SCHEMA_VERSION);
    expect(info).toHaveBeenCalledTimes(1);
  });

  it('writes several stores in one transaction', async () => {
    const db = await openDatabase(factory);
    await db.write([
      { op: 'put', store: 'settings', key: 'current', value: 1 },
      { op: 'put', store: 'delta', key: 'current', value: 2 },
    ]);
    expect(await db.get('settings', 'current')).toBe(1);
    expect(await db.get('delta', 'current')).toBe(2);
    await db.write([{ op: 'delete', store: 'delta', key: 'current' }]);
    expect(await db.get('delta', 'current')).toBeUndefined();
  });

  it('closes its connection on versionchange so another tab can delete the database', async () => {
    const db = await openDatabase(factory);
    await expect(deleteRaw(factory, DATABASE_NAME)).resolves.toBeUndefined();
    await expect(db.get('settings', 'current')).rejects.toBeDefined();
  });

  it('rejects a delete that another tab blocks', async () => {
    await holdStaleConnection(factory);
    await expect(openDatabase(factory)).rejects.toThrow('blocked');
  });
});

describe('createDatabaseProvider', () => {
  it('resolves to IndexedDB and shares one connection', async () => {
    const provider = createDatabaseProvider(new IDBFactory());
    expect(provider.mode.value).toBe('pending');
    const [a, b] = await Promise.all([provider.getDatabase(), provider.getDatabase()]);
    expect(a).toBe(b);
    expect(provider.mode.value).toBe('indexeddb');
  });

  it('falls back to memory when IndexedDB is missing', async () => {
    const provider = createDatabaseProvider(undefined);
    const db = await provider.getDatabase();
    await db.put('settings', 'current', 1);
    expect(await db.get('settings', 'current')).toBe(1);
    expect(provider.mode.value).toBe('memory');
  });

  it('falls back to memory when the open fails', async () => {
    const provider = createDatabaseProvider(new FailingFactory());
    await provider.getDatabase();
    expect(provider.mode.value).toBe('memory');
  });

  it('settles in memory mode when a delete is blocked, instead of waiting', async () => {
    const factory = new IDBFactory();
    await holdStaleConnection(factory);
    const provider = createDatabaseProvider(factory);
    await provider.getDatabase();
    expect(provider.mode.value).toBe('memory');
  });
});
