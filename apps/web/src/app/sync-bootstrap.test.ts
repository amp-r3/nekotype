// @vitest-environment happy-dom
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { createMemoryDb } from '@/shared/lib';

const startSync = vi.hoisted(() => vi.fn());
const checkAccount = vi.hoisted(() => vi.fn());
vi.mock('@/features/sync', () => ({ startSync, checkAccount }));

beforeEach(() => {
  startSync.mockClear();
  checkAccount.mockReset();
  checkAccount.mockResolvedValue(undefined);
  vi.resetModules();
  window.history.replaceState(null, '', '/');
});

const settle = (): Promise<void> => new Promise((resolve) => setTimeout(resolve, 10));

describe('startSyncBootstrap', () => {
  it('never loads the sync engine for a guest', async () => {
    const { startSyncBootstrap } = await import('./sync-bootstrap');
    startSyncBootstrap(Promise.resolve(createMemoryDb()));
    await settle();
    expect(startSync).not.toHaveBeenCalled();
    expect(checkAccount).not.toHaveBeenCalled();
  });

  it('checks the session, then starts the engine of a signed-in user', async () => {
    const db = createMemoryDb();
    await db.put('meta', 'userId', 'user-1');
    const { startSyncBootstrap } = await import('./sync-bootstrap');
    startSyncBootstrap(Promise.resolve(db));
    await settle();
    expect(checkAccount).toHaveBeenCalledWith(db);
    expect(startSync).toHaveBeenCalledWith(db);
  });

  it('checks a sign-in that has just returned, and starts nothing while the choice waits', async () => {
    const db = createMemoryDb();
    await db.put('meta', 'userId', 'user-1');
    await db.put('meta', 'pendingSignIn', { provider: 'google' });
    const { setSignInCheck } = await import('@/entities/user');
    checkAccount.mockImplementation(() => {
      setSignInCheck('choice');
      return Promise.resolve();
    });
    const { startSyncBootstrap } = await import('./sync-bootstrap');
    startSyncBootstrap(Promise.resolve(db));
    await settle();
    expect(checkAccount).toHaveBeenCalledWith(db);
    expect(startSync).not.toHaveBeenCalled();

    setSignInCheck('idle');
    await settle();
    expect(startSync).toHaveBeenCalledTimes(1);
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

  it('takes auth_error out of the address and keeps it until the next navigation', async () => {
    window.history.replaceState(null, '', '/?auth_error=denied&x=1');
    const { navigate, startRouter } = await import('@/shared/lib');
    const stop = startRouter();
    const { startSyncBootstrap } = await import('./sync-bootstrap');
    const { authError } = await import('@/entities/user');
    startSyncBootstrap(Promise.resolve(createMemoryDb()));
    expect(authError.value).toBe('denied');
    expect(window.location.search).toBe('?x=1');

    navigate('/type');
    await settle();
    expect(authError.value).toBeNull();
    stop();
  });

  it('reads any other auth_error as a failure', async () => {
    window.history.replaceState(null, '', '/?auth_error=failed');
    const { startSyncBootstrap } = await import('./sync-bootstrap');
    const { authError } = await import('@/entities/user');
    startSyncBootstrap(Promise.resolve(createMemoryDb()));
    expect(authError.value).toBe('failed');
    expect(window.location.search).toBe('');
  });
});
