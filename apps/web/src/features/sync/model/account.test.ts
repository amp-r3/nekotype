import { describe, expect, it } from 'vitest';
import type { MeResponse, SyncRequest } from '@nekotype/shared/types';
import { isObject } from '@nekotype/shared/runtime';
import type { Db } from '@/shared/lib';
import { createMemoryDb } from '@/shared/lib';
import type { FetchLike } from '@/shared/api';
import type { SignInCheck } from '@/entities/user';
import { createAccount } from './account';
import type { Account } from './account';
import { CATCH_UP_SPACING_MS } from './engine';
import {
  KEY_A,
  TestClock,
  createFakeServer,
  createRig,
  createTestChannel,
  errorResponse,
  learnDelta,
  learnRecord,
  settingsAt,
  signedInDb,
} from './test-util';
import type { FakeServer, Rig, TestChannel } from './test-util';

const entry = (updatedAt: number) => ({ box: 1, dueAt: updatedAt + 1000, updatedAt }) as const;

const me = (id: string, displayName: string | null = 'shiro'): MeResponse => ({
  id,
  email: `${id}@example.com`,
  displayName,
  avatarUrl: null,
});

const json = (status: number, body: unknown): Response =>
  new Response(JSON.stringify(body), { status, headers: { 'Content-Type': 'application/json' } });

const isSyncRequest = (value: unknown): value is SyncRequest =>
  isObject(value) && typeof value['seq'] === 'number' && isObject(value['delta']);

const bodyOf = (request: { body: string | null }): SyncRequest => {
  const parsed: unknown = JSON.parse(request.body ?? 'null');
  if (!isSyncRequest(parsed)) throw new Error('not a sync request');
  return parsed;
};

type Harness = {
  readonly account: Account;
  readonly db: Db;
  readonly calls: { me: number; logout: number };
  readonly checks: SignInCheck[];
  readonly channels: { learn: TestChannel; settings: TestChannel };
  /** What `GET /api/me` answers next. */
  answer: () => Response;
};

function harness(
  db: Db,
  options: { server?: FakeServer; clock?: TestClock; rig?: () => Rig | null } = {},
): Harness {
  const calls = { me: 0, logout: 0 };
  const checks: SignInCheck[] = [];
  const channels = {
    learn: createTestChannel(),
    settings: createTestChannel(),
  };
  const h: Harness = {
    db,
    calls,
    checks,
    channels,
    answer: () => errorResponse(401, 'unauthenticated'),
    account: createAccount({
      db,
      clock: options.clock ?? new TestClock(),
      fetch: ((input, init) => {
        if (input === '/api/me') {
          calls.me += 1;
          return Promise.resolve(h.answer());
        }
        if (input === '/api/auth/logout') {
          calls.logout += 1;
          return Promise.resolve(new Response(null, { status: 204 }));
        }
        if (options.server === undefined) return Promise.reject(new TypeError('no server'));
        return options.server.fetch(input, init);
      }) satisfies FetchLike,
      channels,
      refreshUser: () => Promise.resolve(),
      setSignInCheck: (next) => {
        checks.push(next);
      },
      engine: () => options.rig?.()?.engine ?? null,
    }),
  };
  return h;
}

const learnChanges = () => learnRecord(learnDelta({ entries: { [KEY_A]: entry(5) } }));

/** Runs the engine until nothing is left to send. */
async function drain(rig: Rig): Promise<void> {
  rig.engine.start();
  rig.timers.advance(0);
  await rig.engine.idle();
  for (let i = 0; i < 100 && rig.timers.pending.length > 0; i += 1) {
    rig.timers.advance(CATCH_UP_SPACING_MS);
    await rig.engine.idle();
  }
}

describe('GET /api/me at the start (D19)', () => {
  it('401 for a signed-in user: the session expired, the data stays', async () => {
    const db = await signedInDb();
    await db.put('delta', 'learn', learnChanges());
    await db.put('meta', 'pendingSignIn', { provider: 'github' });
    const h = harness(db);

    await h.account.check();

    expect(await db.get('meta', 'sessionExpired')).toBe(true);
    expect(await db.get('meta', 'pendingSignIn')).toBeUndefined();
    expect(await db.get('meta', 'userId')).toBe('user-1');
    expect(await db.get('delta', 'learn')).toEqual(learnChanges());
    expect(h.checks).toEqual(['idle']);
  });

  it('401 after an abandoned sign-in: the guest stays a guest', async () => {
    const db = createMemoryDb();
    await db.put('meta', 'pendingSignIn', { provider: 'google' });
    const h = harness(db);

    await h.account.check();

    expect(await db.get('meta', 'pendingSignIn')).toBeUndefined();
    expect(await db.get('meta', 'userId')).toBeUndefined();
    expect(await db.get('meta', 'sessionExpired')).toBeUndefined();
  });

  it('200 for a guest: the guest merge, with a new device and nothing sent yet', async () => {
    const db = createMemoryDb();
    await db.put('meta', 'pendingSignIn', { provider: 'github' });
    await db.put('delta', 'learn', learnChanges());
    const h = harness(db);
    h.answer = () => json(200, me('user-1'));

    await h.account.check();

    expect(await db.get('meta', 'userId')).toBe('user-1');
    expect(typeof (await db.get('meta', 'deviceId'))).toBe('string');
    expect(await db.get('meta', 'lastSeq')).toBe(0);
    expect(await db.get('meta', 'profile')).toEqual({
      displayName: 'shiro',
      email: 'user-1@example.com',
      provider: 'github',
    });
    expect(await db.get('meta', 'pendingSignIn')).toBeUndefined();
    // The guest's data goes with the account.
    expect(await db.get('delta', 'learn')).toEqual(learnChanges());
  });

  it('200 for the same user: the session resumes with the same device and lastSeq', async () => {
    const db = await signedInDb('dev-a');
    await db.put('meta', 'lastSeq', 7);
    await db.put('meta', 'sessionExpired', true);
    await db.put('meta', 'profile', { displayName: 'old', email: null, provider: 'github' });
    await db.put('delta', 'learn', learnChanges());
    const h = harness(db);
    h.answer = () => json(200, me('user-1', 'shiro'));

    await h.account.check();

    expect(await db.get('meta', 'sessionExpired')).toBeUndefined();
    expect(await db.get('meta', 'deviceId')).toBe('dev-a');
    expect(await db.get('meta', 'lastSeq')).toBe(7);
    expect(await db.get('delta', 'learn')).toEqual(learnChanges());
    expect(await db.get('meta', 'profile')).toEqual({
      displayName: 'shiro',
      email: 'user-1@example.com',
      provider: 'github',
    });
  });

  it('keeps the provider of the stored profile when no sign-in has just returned', async () => {
    const db = await signedInDb();
    await db.put('meta', 'profile', { displayName: 'a', email: null, provider: 'google' });
    const h = harness(db);
    h.answer = () => json(200, me('user-1', 'b'));

    await h.account.check();

    expect(await db.get('meta', 'profile')).toEqual({
      displayName: 'b',
      email: 'user-1@example.com',
      provider: 'google',
    });
  });

  it('changes nothing without an answer: the next start asks again', async () => {
    const db = await signedInDb();
    await db.put('meta', 'pendingSignIn', { provider: 'github' });
    const h = harness(db);
    h.answer = () => {
      throw new TypeError('Failed to fetch');
    };

    await h.account.check();

    expect(await db.get('meta', 'pendingSignIn')).toEqual({ provider: 'github' });
    expect(await db.get('meta', 'sessionExpired')).toBeUndefined();
    expect(h.checks).toEqual(['idle']);
  });
});

describe('another user signs in (storage-sync.md, "Different user")', () => {
  async function previousUserWithUnsent(): Promise<Db> {
    const db = await signedInDb('dev-a', 'user-1');
    await db.put('meta', 'sessionExpired', true);
    await db.put('meta', 'pendingSignIn', { provider: 'google' });
    await db.put('delta', 'learn', learnChanges());
    await db.put('settings', 'current', settingsAt(500));
    return db;
  }

  it('asks when the device holds unsent data, and cancel keeps everything', async () => {
    const db = await previousUserWithUnsent();
    const h = harness(db);
    h.answer = () => json(200, me('user-2'));

    await h.account.check();
    expect(h.checks).toEqual(['choice']);
    expect(await db.get('meta', 'userId')).toBe('user-1');

    await h.account.resolveAnotherAccount('cancel');

    expect(h.calls.logout).toBe(1);
    expect(h.checks).toEqual(['choice', 'idle']);
    expect(await db.get('meta', 'userId')).toBe('user-1');
    expect(await db.get('meta', 'deviceId')).toBe('dev-a');
    expect(await db.get('meta', 'sessionExpired')).toBe(true);
    expect(await db.get('meta', 'pendingSignIn')).toBeUndefined();
    expect(await db.get('delta', 'learn')).toEqual(learnChanges());
  });

  it('discard clears the device and the new user starts with no local data', async () => {
    const db = await previousUserWithUnsent();
    await db.put('meta', 'keyIntervals', [120, 140]);
    await db.put('meta', 'schemaVersion', 5);
    const h = harness(db);
    h.answer = () => json(200, me('user-2'));

    await h.account.check();
    await h.account.resolveAnotherAccount('discard');

    expect(h.calls.logout).toBe(0);
    expect(await db.get('meta', 'userId')).toBe('user-2');
    expect(await db.get('meta', 'deviceId')).not.toBe('dev-a');
    expect(await db.get('meta', 'lastSeq')).toBe(0);
    expect(await db.get('meta', 'sessionExpired')).toBeUndefined();
    expect(await db.get('delta', 'learn')).toBeUndefined();
    expect(await db.get('settings', 'current')).toBeUndefined();
    // The device's own keys stay.
    expect(await db.get('meta', 'keyIntervals')).toEqual([120, 140]);
    expect(await db.get('meta', 'schemaVersion')).toBe(5);
    // The stores drop their views.
    expect(h.channels.learn.posts).toEqual(['reset']);
    expect(h.channels.settings.posts).toEqual(['reset']);
  });

  it('clears silently when nothing of the previous account is unsent', async () => {
    const db = await signedInDb('dev-a', 'user-1');
    const h = harness(db);
    h.answer = () => json(200, me('user-2'));

    await h.account.check();

    expect(h.checks).toEqual(['idle']);
    expect(await db.get('meta', 'userId')).toBe('user-2');
  });
});

describe('the guest merge with the engine (acceptance 10)', () => {
  it('sends the guest delta in the first batch', async () => {
    const db = createMemoryDb();
    await db.put('delta', 'learn', learnChanges());
    const server = createFakeServer();
    const clock = new TestClock();
    const h = harness(db, { server, clock });
    h.answer = () => json(200, me('user-1'));

    await h.account.check();
    const rig = await createRig({ db, server, clock });
    await drain(rig);

    const posts = server.posts().map(bodyOf);
    expect(posts).toHaveLength(1);
    expect(posts[0]?.delta.learn.entries[KEY_A]).toEqual(entry(5));
  });
});

describe('an expired session resumes (acceptance 8)', () => {
  it('sends under the same deviceId and seq after signing in again', async () => {
    const server = createFakeServer();
    const clock = new TestClock();
    const db = await signedInDb('dev-a', 'user-1');
    const first = await createRig({ db, server, clock });
    await db.put('delta', 'learn', learnChanges());
    await drain(first);
    first.engine.stop();
    expect(server.lastSeq('dev-a')).toBe(1);

    // The session expires with a batch waiting.
    await db.put('delta', 'learn', learnRecord(learnDelta({ entries: { [KEY_A]: entry(9) } })));
    server.force(() => errorResponse(401, 'unauthenticated'));
    const second = await createRig({ db, server, clock });
    await drain(second);
    second.engine.stop();
    expect(await db.get('meta', 'sessionExpired')).toBe(true);

    const h = harness(db, { server, clock });
    h.answer = () => json(200, me('user-1'));
    await h.account.check();
    const third = await createRig({ db, server, clock });
    await drain(third);

    const last = server.posts().map(bodyOf).at(-1);
    expect(last?.deviceId).toBe('dev-a');
    expect(last?.seq).toBe(2);
    expect(server.lastSeq('dev-a')).toBe(2);
    expect(server.snapshot().learn.entries[KEY_A]).toEqual(entry(9));
  });
});

describe('sign-out', () => {
  it('syncs first, and asks only when something is still unsent', async () => {
    const server = createFakeServer();
    const clock = new TestClock();
    const db = await signedInDb();
    await db.put('delta', 'learn', learnChanges());
    const rig = await createRig({ db, server, clock });
    rig.engine.start();
    const h = harness(db, { server, clock, rig: () => rig });

    const unsent = await h.account.prepareSignOut();

    expect(server.posts()).toHaveLength(1);
    expect(unsent).toBe(false);
  });

  it('names the unsent progress when the sync cannot send it', async () => {
    const server = createFakeServer();
    const db = await signedInDb();
    await db.put('delta', 'learn', learnChanges());
    const rig = await createRig({ db, server });
    rig.engine.start();
    server.forceNetworkError();
    const h = harness(db, { server, rig: () => rig });

    expect(await h.account.prepareSignOut()).toBe(true);
  });

  it('with an expired session does not sync and says what waits', async () => {
    const server = createFakeServer();
    const db = await signedInDb();
    await db.put('meta', 'sessionExpired', true);
    await db.put('delta', 'learn', learnChanges());
    const rig = await createRig({ db, server });
    const h = harness(db, { server, rig: () => rig });

    expect(await h.account.prepareSignOut()).toBe(true);
    expect(server.requests).toHaveLength(0);

    expect(await h.account.signOut()).toBe(true);
    expect(h.calls.logout).toBe(0);
    expect(await db.get('meta', 'userId')).toBeUndefined();
  });

  it('deletes the session, clears the user stores and resets the settings (Q3)', async () => {
    const db = await signedInDb();
    await db.put('meta', 'profile', { displayName: 'a', email: null, provider: 'github' });
    await db.put('meta', 'keyIntervals', [100]);
    await db.put('settings', 'current', settingsAt(500));
    await db.put('snapshot', 'current', { any: 1 });
    const h = harness(db);

    expect(await h.account.signOut()).toBe(true);

    expect(h.calls.logout).toBe(1);
    for (const key of ['userId', 'deviceId', 'lastSeq', 'profile']) {
      expect(await db.get('meta', key)).toBeUndefined();
    }
    expect(await db.get('meta', 'keyIntervals')).toEqual([100]);
    expect(await db.get('settings', 'current')).toBeUndefined();
    expect(await db.get('snapshot', 'current')).toBeUndefined();
    expect(h.channels.settings.posts).toEqual(['reset']);
  });

  it('keeps everything when the server cannot be reached', async () => {
    const db = await signedInDb();
    await db.put('settings', 'current', settingsAt(500));
    const calls = { logout: 0 };
    const account = createAccount({
      db,
      clock: new TestClock(),
      fetch: () => {
        calls.logout += 1;
        return Promise.reject(new TypeError('Failed to fetch'));
      },
      channels: {
        learn: createTestChannel(),
        settings: createTestChannel(),
      },
      refreshUser: () => Promise.resolve(),
      setSignInCheck: () => {},
      engine: () => null,
    });

    expect(await account.signOut()).toBe(false);
    expect(calls.logout).toBe(1);
    expect(await db.get('meta', 'userId')).toBe('user-1');
    expect(await db.get('settings', 'current')).toEqual(settingsAt(500));
  });

  it('signing out and in again to the same account restores everything from the server (acceptance 11)', async () => {
    const server = createFakeServer();
    const clock = new TestClock();
    const db = await signedInDb('dev-a', 'user-1');
    await db.put('delta', 'learn', learnChanges());
    const rig = await createRig({ db, server, clock });
    await drain(rig);
    const h = harness(db, { server, clock, rig: () => rig });

    expect(await h.account.prepareSignOut()).toBe(false);
    expect(await h.account.signOut()).toBe(true);
    expect(await db.get('snapshot', 'current')).toBeUndefined();

    // Signing in again: a new device of the same account pulls the snapshot.
    h.answer = () => json(200, me('user-1'));
    await h.account.check();
    const again = await createRig({ db, server, clock });
    await drain(again);

    expect(await db.get('snapshot', 'current')).toEqual(server.snapshot());
    expect(await db.get('meta', 'deviceId')).not.toBe('dev-a');
  });
});

describe('deleteAccount', () => {
  const setup = async (answer: () => Promise<Response>) => {
    const db = await signedInDb();
    await db.put('meta', 'profile', { displayName: 'a', email: null, provider: 'github' });
    await db.put('meta', 'keyIntervals', [100]);
    await db.put('settings', 'current', settingsAt(500));
    await db.put('delta', 'learn', learnChanges());
    const requests: { input: string; method: string | undefined }[] = [];
    const channels = {
      learn: createTestChannel(),
      settings: createTestChannel(),
    };
    const account = createAccount({
      db,
      clock: new TestClock(),
      fetch: ((input, init) => {
        requests.push({ input, method: init.method });
        return answer();
      }) satisfies FetchLike,
      channels,
      refreshUser: () => Promise.resolve(),
      setSignInCheck: () => {},
      engine: () => null,
    });
    return { db, account, requests, channels };
  };

  it('clears the user stores and the settings after a 204 and leaves a guest', async () => {
    const { db, account, requests, channels } = await setup(() =>
      Promise.resolve(new Response(null, { status: 204 })),
    );

    expect(await account.deleteAccount()).toBe(true);

    expect(requests).toEqual([{ input: '/api/me', method: 'DELETE' }]);
    for (const key of ['userId', 'deviceId', 'lastSeq', 'profile']) {
      expect(await db.get('meta', key)).toBeUndefined();
    }
    expect(await db.get('meta', 'keyIntervals')).toEqual([100]);
    expect(await db.get('settings', 'current')).toBeUndefined();
    expect(await db.get('delta', 'learn')).toBeUndefined();
    expect(channels.learn.posts).toEqual(['reset']);
    expect(channels.settings.posts).toEqual(['reset']);
  });

  it.each([
    ['a network failure', () => Promise.reject(new TypeError('Failed to fetch'))],
    ['a 401', () => Promise.resolve(errorResponse(401, 'unauthenticated'))],
    ['a 503', () => Promise.resolve(errorResponse(503, 'unavailable'))],
  ])('keeps everything after %s', async (_name, answer) => {
    const { db, account } = await setup(answer);

    expect(await account.deleteAccount()).toBe(false);

    expect(await db.get('meta', 'userId')).toBe('user-1');
    expect(await db.get('settings', 'current')).toEqual(settingsAt(500));
    expect(await db.get('delta', 'learn')).toBeDefined();
  });
});
