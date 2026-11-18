import { describe, expect, it } from 'vitest';
import { createMemoryDb } from '@/shared/lib';
import { initUser, refreshUser, userId } from './store';

describe('the user signal', () => {
  it('is null for a guest', async () => {
    await initUser(createMemoryDb());
    expect(userId.value).toBeNull();
  });

  it('reads meta.userId at the start, and again after a refresh', async () => {
    const db = createMemoryDb();
    await db.put('meta', 'userId', 'user-1');
    await initUser(db);
    expect(userId.value).toBe('user-1');

    await db.delete('meta', 'userId');
    await refreshUser();
    expect(userId.value).toBeNull();
  });

  it('treats a value that is not a string as no user', async () => {
    const db = createMemoryDb();
    await db.put('meta', 'userId', 42);
    await initUser(db);
    expect(userId.value).toBeNull();
  });

  it('stays as it was when the database cannot be read', async () => {
    const db = createMemoryDb();
    await db.put('meta', 'userId', 'user-2');
    await initUser(db);
    const broken = { ...db, get: () => Promise.reject(new Error('closed')) };
    await initUser(broken);
    expect(userId.value).toBe('user-2');
  });
});
