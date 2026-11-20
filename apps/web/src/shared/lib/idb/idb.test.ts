import { describe, it, expect } from 'vitest';
import { IDBFactory } from 'fake-indexeddb';
import { openRaw } from './idb';
import { createMemoryDb } from './memory-db';
import type { Db } from './idb';

const STORES = ['a', 'b'] as const;

const backends: readonly [string, () => Promise<Db>][] = [
  ['IndexedDB', async () => (await openRaw(new IDBFactory(), 'test', STORES)).db],
  ['the memory fallback', () => Promise.resolve(createMemoryDb())],
];

describe.each(backends)('Db.update on %s', (_name, open) => {
  it('hands the values read to compute, undefined for a missing record, and applies its writes', async () => {
    const db = await open();
    await db.put('a', 'x', 1);
    let seen: readonly unknown[] = [];
    await db.update(
      [
        { store: 'a', key: 'x' },
        { store: 'b', key: 'missing' },
      ],
      (values) => {
        seen = values;
        return [
          { op: 'put', store: 'a', key: 'x', value: 2 },
          { op: 'put', store: 'b', key: 'y', value: 3 },
        ];
      },
    );
    expect(seen).toEqual([1, undefined]);
    expect(await db.get('a', 'x')).toBe(2);
    expect(await db.get('b', 'y')).toBe(3);
  });

  it('writes to a store named in `scope` that it does not read', async () => {
    const db = await open();
    await db.update(
      [{ store: 'a', key: 'x' }],
      () => [{ op: 'put', store: 'b', key: 'y', value: 1 }],
      ['b'],
    );
    expect(await db.get('b', 'y')).toBe(1);
  });

  it('applies none of the writes when compute throws, and rejects', async () => {
    const db = await open();
    await db.put('a', 'x', 1);
    await expect(
      db.update([{ store: 'a', key: 'x' }], () => {
        throw new Error('no');
      }),
    ).rejects.toThrow('no');
    expect(await db.get('a', 'x')).toBe(1);
  });

  it('applies none of the writes when one is outside the stores of the transaction', async () => {
    const db = await open();
    await expect(
      db.update([{ store: 'a', key: 'x' }], () => [
        { op: 'put', store: 'a', key: 'x', value: 9 },
        { op: 'put', store: 'b', key: 'y', value: 9 },
      ]),
    ).rejects.toThrow();
    expect(await db.get('a', 'x')).toBeUndefined();
    expect(await db.get('b', 'y')).toBeUndefined();
  });

  it('does not lose an increment when two updates run at once', async () => {
    const db = await open();
    await db.put('a', 'n', 0);
    const bump = () =>
      db.update([{ store: 'a', key: 'n' }], ([n]) => [
        { op: 'put', store: 'a', key: 'n', value: Number(n) + 1 },
      ]);
    await Promise.all([bump(), bump(), bump()]);
    expect(await db.get('a', 'n')).toBe(3);
  });

  it('reads and writes nothing for no reads and no writes', async () => {
    const db = await open();
    await db.update([], () => []);
    expect(await db.get('a', 'x')).toBeUndefined();
  });
});
