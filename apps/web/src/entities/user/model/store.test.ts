import { describe, expect, it } from 'vitest';
import { createMemoryDb } from '@/shared/lib';
import {
  authAvailable,
  beginSignIn,
  initUser,
  isAuthHost,
  storedProfile,
  refreshUser,
  sessionExpired,
  setSignInCheck,
  signInCheck,
  userId,
} from './store';

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

describe('the user keys of meta and sign-in (D19, D20)', () => {
  it('reads the profile and the expired session of a signed-in user', async () => {
    const db = createMemoryDb();
    await db.put('meta', 'userId', 'user-1');
    await db.put('meta', 'sessionExpired', true);
    await db.put('meta', 'profile', { displayName: 'shiro', email: null, provider: 'google' });
    await initUser(db);
    expect(sessionExpired.value).toBe(true);
    expect(storedProfile.value).toEqual({ displayName: 'shiro', email: null, provider: 'google' });

    await db.delete('meta', 'userId');
    await refreshUser();
    expect(sessionExpired.value).toBe(false);
    expect(storedProfile.value).toBeNull();
  });

  it('returns the provider of a sign-in that has just returned and marks the check', async () => {
    setSignInCheck('idle');
    const db = createMemoryDb();
    expect(await initUser(db)).toBe(false);
    expect(signInCheck.value).toBe('idle');

    await db.put('meta', 'pendingSignIn', { provider: 'github' });
    expect(await initUser(db)).toBe(true);
    expect(signInCheck.value).toBe('checking');
    setSignInCheck('idle');
  });

  it.each([
    ['nekotype.pages.dev', true],
    ['localhost', true],
    ['127.0.0.1', true],
    ['release-candidate.nekotype.pages.dev', false],
    ['abc123.nekotype.pages.dev', false],
    ['example.com', false],
  ])('offers sign-in on %s: %s', async (host, offered) => {
    expect(isAuthHost(host)).toBe(offered);
    await initUser(createMemoryDb(), host);
    expect(authAvailable.value).toBe(offered);
  });

  it('writes pendingSignIn before it leaves for the provider', async () => {
    const db = createMemoryDb();
    await initUser(db);
    const seen: unknown[] = [];
    await beginSignIn('google', (url) => {
      seen.push(url);
      void db.get('meta', 'pendingSignIn').then((value) => seen.push(value));
    });
    await Promise.resolve();
    expect(seen).toEqual(['/api/auth/google', { provider: 'google' }]);
  });
});
