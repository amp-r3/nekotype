import { beforeEach, describe, expect, it, vi } from 'vitest';
import { createMemoryDb } from '@/shared/lib';

const startSync = vi.hoisted(() => vi.fn());
vi.mock('@/features/sync', () => ({ startSync }));

beforeEach(() => {
  startSync.mockClear();
  vi.resetModules();
});

const settle = (): Promise<void> => new Promise((resolve) => setTimeout(resolve, 10));

describe('startSyncBootstrap', () => {
  it('never loads the sync engine for a guest', async () => {
    const { startSyncBootstrap } = await import('./sync-bootstrap');
    startSyncBootstrap(Promise.resolve(createMemoryDb()));
    await settle();
    expect(startSync).not.toHaveBeenCalled();
  });

  it('starts the engine on the database of a signed-in user', async () => {
    const db = createMemoryDb();
    await db.put('meta', 'userId', 'user-1');
    const { startSyncBootstrap } = await import('./sync-bootstrap');
    startSyncBootstrap(Promise.resolve(db));
    await settle();
    expect(startSync).toHaveBeenCalledWith(db);
  });

  it('starts it when the user signs in later, as another tab does through the channel', async () => {
    const db = createMemoryDb();
    const { startSyncBootstrap } = await import('./sync-bootstrap');
    const { refreshUser } = await import('@/entities/user');
    startSyncBootstrap(Promise.resolve(db));
    await settle();
    expect(startSync).not.toHaveBeenCalled();

    await db.put('meta', 'userId', 'user-1');
    await refreshUser();
    await settle();
    expect(startSync).toHaveBeenCalledTimes(1);
  });

  it('does nothing when the database cannot be opened', async () => {
    const { startSyncBootstrap } = await import('./sync-bootstrap');
    startSyncBootstrap(Promise.reject(new Error('no storage')));
    await settle();
    expect(startSync).not.toHaveBeenCalled();
  });
});
