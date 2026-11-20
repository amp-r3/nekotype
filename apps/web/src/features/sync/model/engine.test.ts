import { describe, expect, it } from 'vitest';
import type { Outbox, Snapshot, SyncRequest } from '@nekotype/shared/types';
import { isObject, isSnapshot } from '@nekotype/shared/runtime';
import { createMemoryDb } from '@/shared/lib';
import {
  AFTER_WORK_MS,
  CATCH_UP_SPACING_MS,
  KEEPALIVE_MAX_BYTES,
  REQUEST_SPACING_MS,
} from './engine';
import {
  KEY_A,
  KEY_I,
  createFakeServer,
  createRig,
  createTestLocks,
  emptyCounters,
  errorResponse,
  learnDelta,
  learnRecord,
  settingsAt,
  signedInDb,
} from './test-util';
import type { Rig } from './test-util';

const isSyncRequest = (value: unknown): value is SyncRequest =>
  isObject(value) && value['v'] === 2 && typeof value['seq'] === 'number';

const entry = (updatedAt: number) => ({ box: 1, dueAt: updatedAt + 1000, updatedAt }) as const;

async function sync(rig: Rig): Promise<void> {
  rig.engine.start();
  rig.timers.advance(0);
  await rig.engine.idle();
}

const body = (request: { body: string | null }): SyncRequest => {
  const parsed: unknown = JSON.parse(request.body ?? 'null');
  if (!isSyncRequest(parsed)) throw new Error('not a sync request');
  return parsed;
};

describe('a batch', () => {
  it('is built from the learning delta and the changed settings, and clears what it took', async () => {
    const rig = await createRig();
    await rig.db.put(
      'delta',
      'learn',
      learnRecord(learnDelta({ entries: { [KEY_A]: entry(5) } }), {
        ...emptyCounters(),
        started: 2,
        finished: 1,
      }),
    );
    await rig.db.put('settings', 'current', settingsAt(900));
    await sync(rig);

    const [first] = rig.server.posts();
    expect(first).toBeDefined();
    const sent = body(first ?? { body: null });
    expect(sent.seq).toBe(1);
    expect(sent.deviceId).toBe('dev-a');
    expect(sent.delta.settings?.updatedAt).toBe(900);
    expect(Object.keys(sent.delta.learn.entries)).toEqual([KEY_A]);
    expect(sent.delta.counters).toEqual({ started: 2, finished: 1 });
    // The acknowledgement cleared the outbox; the delta left `delta` in the same transaction.
    expect(await rig.db.get('outbox', 'current')).toBeUndefined();
    expect(await rig.db.get('delta', 'learn')).toBeUndefined();
  });

  it('splits a delta over the caps: the rest stays in delta and follows 5 seconds later', async () => {
    const rig = await createRig();
    const entries: Record<string, ReturnType<typeof entry>> = {};
    for (let i = 0; i < 70; i += 1) entries[`hiragana:k${String(i).padStart(3, '0')}`] = entry(i);
    await rig.db.put('delta', 'learn', learnRecord(learnDelta({ entries })));

    await sync(rig);

    const first = body(rig.server.posts()[0] ?? { body: null });
    expect(Object.keys(first.delta.learn.entries)).toHaveLength(60);
    const kept = await rig.db.get('delta', 'learn');
    expect(JSON.stringify(kept)).toContain('k069');
    expect(rig.timers.pending).toEqual([CATCH_UP_SPACING_MS]);

    rig.timers.advance(CATCH_UP_SPACING_MS);
    await rig.engine.idle();
    const second = body(rig.server.posts()[1] ?? { body: null });
    expect(Object.keys(second.delta.learn.entries)).toHaveLength(10);
    expect(await rig.db.get('delta', 'learn')).toBeUndefined();
  });

  it('sends nothing when nothing changed', async () => {
    const rig = await createRig();
    await sync(rig);
    expect(rig.server.posts()).toEqual([]);
  });
});

describe('an unacknowledged batch', () => {
  it('is resent unchanged', async () => {
    const rig = await createRig();
    await rig.db.put('delta', 'learn', learnRecord(learnDelta({ entries: { [KEY_A]: entry(5) } })));
    rig.server.forceNetworkError();

    await sync(rig);
    const stored = await rig.db.get('outbox', 'current');
    expect(stored).toBeDefined();
    expect(rig.server.posts()).toHaveLength(1);
    expect(rig.server.version()).toBe(0);

    rig.timers.advance(REQUEST_SPACING_MS);
    rig.env.goOnline();
    rig.timers.advance(0);
    await rig.engine.idle();

    expect(rig.server.posts()).toHaveLength(2);
    expect(rig.server.posts()[1]?.body).toBe(rig.server.posts()[0]?.body);
    expect(await rig.db.get('outbox', 'current')).toBeUndefined();
    expect(rig.server.version()).toBe(1);
  });
});

describe('an acknowledgement', () => {
  it('with version = stored + 1 applies the batch to the snapshot and equals what the server stored', async () => {
    const rig = await createRig();
    await rig.db.put('delta', 'learn', learnRecord(learnDelta({ entries: { [KEY_A]: entry(5) } })));
    await sync(rig);
    // The first batch has no snapshot to apply to: the parts were read.
    expect(rig.server.gets().filter((g) => g.url.includes('part='))).toHaveLength(3);
    expect(await rig.db.get('meta', 'snapshotVersion')).toBe(1);

    await rig.db.put('delta', 'learn', learnRecord(learnDelta({ entries: { [KEY_I]: entry(9) } })));
    rig.request();
    rig.timers.advance(AFTER_WORK_MS);
    await rig.engine.idle();

    // The second batch: only the POST, no read of the parts.
    expect(rig.server.gets().filter((g) => g.url.includes('part='))).toHaveLength(3);
    expect(rig.server.posts()).toHaveLength(2);
    expect(await rig.db.get('meta', 'snapshotVersion')).toBe(2);
    expect(await rig.db.get('meta', 'lastSeq')).toBe(2);
    expect(await rig.db.get('snapshot', 'current')).toEqual(rig.server.snapshot());
  });

  it('with another version reads the three parts, and again when their versions differ', async () => {
    const rig = await createRig();
    const other: SyncRequest = {
      v: 2,
      deviceId: 'dev-b',
      seq: 1,
      delta: {
        counters: emptyCounters(),
        learn: learnDelta({ entries: { [KEY_I]: entry(3) } }),
        settings: null,
      },
    };
    await rig.db.put('delta', 'learn', learnRecord(learnDelta({ entries: { [KEY_A]: entry(5) } })));
    let writes = 0;
    rig.server.onPart((part) => {
      // Another device writes between two parts of the first read.
      if (part === 'recent' && writes === 0) {
        writes += 1;
        rig.server.externalWrite(other);
      }
    });

    await sync(rig);

    // The three parts were requested twice: the first set disagreed on `version`.
    expect(rig.server.gets().filter((g) => g.url.includes('part='))).toHaveLength(6);
    const snapshot = await rig.db.get('snapshot', 'current');
    expect(snapshot).toEqual(rig.server.snapshot());
    expect(await rig.db.get('meta', 'snapshotVersion')).toBe(rig.server.version());
    expect(Object.keys(rig.server.snapshot().learn.entries).sort()).toEqual([KEY_A, KEY_I]);
  });

  it('applies the settings rule', async () => {
    const rig = await createRig();
    const server: Snapshot = {
      ...rig.server.snapshot(),
      settings: settingsAt(500),
    };
    rig.server.setSnapshot(server, 4);
    await rig.db.put('settings', 'current', settingsAt(100));
    await rig.db.put('meta', 'settingsSyncedAt', 100);
    await sync(rig);

    expect(await rig.db.get('settings', 'current')).toEqual(settingsAt(500));
    expect(await rig.db.get('meta', 'settingsSyncedAt')).toBe(500);
    expect(rig.channels.settings.posts).toEqual(['change']);
    expect(rig.channels.learn.posts).toEqual(['change']);
  });

  it('keeps settings that changed after the batch was built, and sends them next', async () => {
    const rig = await createRig();
    await rig.db.put('settings', 'current', settingsAt(100));
    rig.server.onRequest((request) => {
      if (request.method === 'POST') void rig.db.put('settings', 'current', settingsAt(300));
    });

    await sync(rig);

    expect(await rig.db.get('settings', 'current')).toEqual(settingsAt(300));
    // The batch carried 100; 300 is newer than what the server holds, so it is still to send.
    expect(await rig.db.get('meta', 'settingsSyncedAt')).toBe(100);
    rig.server.onRequest(null);
    rig.request();
    rig.timers.advance(AFTER_WORK_MS);
    await rig.engine.idle();
    expect(body(rig.server.posts()[1] ?? { body: null }).delta.settings?.updatedAt).toBe(300);
    expect(rig.server.snapshot().settings?.updatedAt).toBe(300);
  });

  it('the account settings win on the first batch of a sign-in', async () => {
    const rig = await createRig();
    rig.server.setSnapshot({ ...rig.server.snapshot(), settings: settingsAt(40) }, 2);
    await rig.db.put('settings', 'current', settingsAt(700));

    await sync(rig);

    expect(await rig.db.get('settings', 'current')).toEqual(settingsAt(40));
    expect(await rig.db.get('meta', 'settingsSyncedAt')).toBe(40);
  });
});

describe('failed requests', () => {
  async function pending(rig: Rig): Promise<void> {
    await rig.db.put('delta', 'learn', learnRecord(learnDelta({ entries: { [KEY_A]: entry(5) } })));
  }

  it('a 409 rewrites the seq of the outbox to lastSeq + 1 and resends at once', async () => {
    const rig = await createRig();
    await pending(rig);
    await rig.db.put('meta', 'lastSeq', 7);
    rig.server.setLastSeq('dev-a', 2);

    await sync(rig);

    const seqs = rig.server.posts().map((p) => body(p).seq);
    expect(seqs).toEqual([8, 3]);
    expect(rig.server.lastSeq('dev-a')).toBe(3);
    expect(await rig.db.get('meta', 'lastSeq')).toBe(3);
    expect(await rig.db.get('outbox', 'current')).toBeUndefined();
  });

  it.each([
    ['429', () => errorResponse(429, 'rate_limited', { retryAfter: 12 })],
    ['503 with Retry-After', () => errorResponse(503, 'conflict', { retryAfter: 12 })],
  ])('a %s waits for Retry-After, then retries and drops nothing', async (_name, response) => {
    const rig = await createRig();
    await pending(rig);
    rig.server.force(response);

    await sync(rig);
    expect(rig.server.posts()).toHaveLength(1);
    expect(await rig.db.get('outbox', 'current')).toBeDefined();
    expect(rig.timers.pending).toEqual([12_000]);

    rig.timers.advance(11_999);
    await rig.engine.idle();
    expect(rig.server.posts()).toHaveLength(1);
    rig.timers.advance(1);
    await rig.engine.idle();
    expect(rig.server.posts()).toHaveLength(2);
    expect(await rig.db.get('outbox', 'current')).toBeUndefined();
  });

  it('a network error leaves everything in place, shows offline and the next trigger retries', async () => {
    const { syncStatus } = await import('./status');
    const rig = await createRig();
    await pending(rig);
    rig.server.forceNetworkError();

    await sync(rig);

    expect(await rig.db.get('outbox', 'current')).toBeDefined();
    expect(syncStatus.value).toBe('offline');
    rig.timers.advance(REQUEST_SPACING_MS);
    rig.env.goOnline();
    rig.timers.advance(0);
    await rig.engine.idle();
    expect(rig.server.version()).toBe(1);
    expect(syncStatus.value).toBe('synced');
  });

  it('a 5xx keeps the batch and sets no timer', async () => {
    const rig = await createRig();
    await pending(rig);
    rig.server.force(() => errorResponse(503, 'unavailable'));

    await sync(rig);

    expect(await rig.db.get('outbox', 'current')).toBeDefined();
    expect(rig.timers.pending).toEqual([]);
  });

  it('a 401 sets sessionExpired, tells the user signals and stops syncing', async () => {
    const { syncStatus } = await import('./status');
    const rig = await createRig();
    await pending(rig);
    rig.server.force(() => errorResponse(401, 'unauthenticated'));

    await sync(rig);

    expect(await rig.db.get('meta', 'sessionExpired')).toBe(true);
    expect(rig.refreshed.count).toBe(1);
    expect(await rig.db.get('outbox', 'current')).toBeDefined();
    expect(syncStatus.value).toBe('expired');

    rig.env.goOnline();
    rig.timers.advance(REQUEST_SPACING_MS);
    await rig.engine.idle();
    expect(rig.server.requests).toHaveLength(1);
  });

  it.each([400, 413])(
    'a %i blocks syncing until the application version changes',
    async (status) => {
      const { syncStatus } = await import('./status');
      const rig = await createRig();
      await pending(rig);
      rig.server.force(() => errorResponse(status, status === 400 ? 'invalid_body' : 'too_large'));

      await sync(rig);

      expect(await rig.db.get('meta', 'syncBlockedAtVersion')).toBe('v1');
      expect(syncStatus.value).toBe('blocked');
      expect(await rig.db.get('outbox', 'current')).toBeDefined();

      // The same version does not retry.
      rig.engine.stop();
      const again = await createRig({ db: rig.db, server: rig.server, appVersion: 'v1' });
      await sync(again);
      expect(rig.server.requests).toHaveLength(1);

      // A new release may accept the batch.
      const next = await createRig({ db: rig.db, server: rig.server, appVersion: 'v2' });
      await sync(next);
      expect(rig.server.posts()).toHaveLength(2);
      expect(await rig.db.get('meta', 'syncBlockedAtVersion')).toBeUndefined();
      expect(await rig.db.get('outbox', 'current')).toBeUndefined();
    },
  );
});

describe('spacing', () => {
  it('sends a batch 10 seconds after the work ends, once for several triggers', async () => {
    const rig = await createRig();
    await sync(rig);
    await rig.db.put('delta', 'learn', learnRecord(learnDelta({ entries: { [KEY_A]: entry(5) } })));
    rig.request();
    rig.timers.advance(3000);
    rig.request();
    expect(rig.timers.pending).toEqual([AFTER_WORK_MS - 3000]);
    rig.timers.advance(AFTER_WORK_MS - 3000 - 1);
    await rig.engine.idle();
    expect(rig.server.posts()).toHaveLength(0);
    rig.timers.advance(1);
    await rig.engine.idle();
    expect(rig.server.posts()).toHaveLength(1);
  });

  it('does not send twice within 10 seconds', async () => {
    const rig = await createRig();
    await rig.db.put('delta', 'learn', learnRecord(learnDelta({ entries: { [KEY_A]: entry(5) } })));
    await sync(rig);
    expect(rig.server.posts()).toHaveLength(1);

    await rig.db.put('delta', 'learn', learnRecord(learnDelta({ entries: { [KEY_I]: entry(9) } })));
    rig.timers.advance(2000);
    rig.env.goOnline();
    rig.timers.advance(0);
    await rig.engine.idle();
    expect(rig.server.posts()).toHaveLength(1);

    rig.timers.advance(REQUEST_SPACING_MS - 2000);
    await rig.engine.idle();
    expect(rig.server.posts()).toHaveLength(2);
  });
});

describe('the hidden page', () => {
  it('sends the delta with keepalive', async () => {
    const rig = await createRig();
    await rig.db.put('delta', 'learn', learnRecord(learnDelta({ entries: { [KEY_A]: entry(5) } })));
    rig.engine.start();

    rig.env.hide();
    await rig.engine.idle();
    await new Promise((resolve) => setTimeout(resolve, 0));
    await rig.engine.idle();

    const [post] = rig.server.posts();
    expect(post?.keepalive).toBe(true);
    expect(await rig.db.get('outbox', 'current')).toBeUndefined();
  });

  it('resends an outbox within 60 KB, and nothing above it', async () => {
    const small = await createRig();
    await sync(small);
    const outbox: Outbox = {
      seq: 1,
      request: {
        v: 2,
        deviceId: 'dev-a',
        seq: 1,
        delta: {
          counters: emptyCounters(),
          learn: learnDelta({ entries: { [KEY_A]: entry(5) } }),
          settings: null,
        },
      },
    };
    await small.db.put('outbox', 'current', outbox);
    small.env.hide();
    await new Promise((resolve) => setTimeout(resolve, 0));
    await small.engine.idle();
    expect(small.server.posts()).toHaveLength(1);
    expect(small.server.posts()[0]?.keepalive).toBe(true);

    const big = await createRig();
    await sync(big);
    // 1500 entries of about 65 bytes each are over 60 KB.
    const entries: Record<string, ReturnType<typeof entry>> = {};
    for (let i = 0; i < 1500; i += 1) entries[`hiragana:k${String(i).padStart(4, '0')}`] = entry(i);
    const request: SyncRequest = {
      ...outbox.request,
      delta: { ...outbox.request.delta, learn: learnDelta({ entries }) },
    };
    await big.db.put('outbox', 'current', { ...outbox, request });
    expect(JSON.stringify(request).length).toBeGreaterThan(KEEPALIVE_MAX_BYTES);
    big.env.hide();
    await new Promise((resolve) => setTimeout(resolve, 0));
    await big.engine.idle();
    expect(big.server.posts()).toHaveLength(0);
  });

  it('sends nothing when the lock is held by a running sync', async () => {
    const rig = await createRig();
    await rig.db.put('delta', 'learn', learnRecord(learnDelta({ entries: { [KEY_A]: entry(5) } })));
    rig.engine.start();
    let release: () => void = () => {};
    const holding = rig.locks.run(
      () =>
        new Promise<void>((resolve) => {
          release = resolve;
        }),
    );
    await Promise.resolve();
    rig.env.hide();
    await new Promise((resolve) => setTimeout(resolve, 0));
    expect(rig.server.requests).toHaveLength(0);
    release();
    await holding;
  });
});

describe('two engines on one database', () => {
  it('send one batch', async () => {
    const db = await signedInDb();
    await db.put('delta', 'learn', learnRecord(learnDelta({ entries: { [KEY_A]: entry(5) } })));
    const server = createFakeServer();
    const locks = createTestLocks();
    const one = await createRig({ db, server, locks });
    const two = await createRig({ db, server, locks });

    one.engine.start();
    two.engine.start();
    one.timers.advance(0);
    two.timers.advance(0);
    await one.engine.idle();
    await two.engine.idle();

    expect(server.posts()).toHaveLength(1);
    expect(await db.get('outbox', 'current')).toBeUndefined();
  });
});

describe('two devices against one server', () => {
  it('converge', async () => {
    const server = createFakeServer();
    const a = await createRig({ db: await signedInDb('dev-a'), server });
    const b = await createRig({ db: await signedInDb('dev-b'), server });
    await a.db.put('delta', 'learn', learnRecord(learnDelta({ entries: { [KEY_A]: entry(5) } })));
    await b.db.put('delta', 'learn', learnRecord(learnDelta({ entries: { [KEY_I]: entry(6) } })));

    await sync(a);
    await sync(b);
    // A has nothing to send: on `online` it reads what B wrote.
    a.timers.advance(REQUEST_SPACING_MS);
    a.env.goOnline();
    a.timers.advance(0);
    await a.engine.idle();

    const stored = await a.db.get('snapshot', 'current');
    expect(isSnapshot(stored)).toBe(true);
    expect(stored).toEqual(server.snapshot());
    expect(await b.db.get('snapshot', 'current')).toEqual(server.snapshot());
    expect(Object.keys(server.snapshot().learn.entries).sort()).toEqual([KEY_A, KEY_I]);
    expect(await a.db.get('meta', 'snapshotVersion')).toBe(2);
  });
});

describe('start and online with nothing to send', () => {
  it('check the version, and read the parts only when it differs', async () => {
    const rig = await createRig();
    rig.server.setSnapshot({ ...rig.server.snapshot(), settings: settingsAt(9) }, 3);

    await sync(rig);
    expect(rig.server.gets().filter((g) => !g.url.includes('part='))).toHaveLength(1);
    expect(rig.server.gets().filter((g) => g.url.includes('part='))).toHaveLength(3);
    expect(await rig.db.get('meta', 'snapshotVersion')).toBe(3);

    rig.timers.advance(REQUEST_SPACING_MS);
    rig.env.goOnline();
    rig.timers.advance(0);
    await rig.engine.idle();
    expect(rig.server.gets().filter((g) => !g.url.includes('part='))).toHaveLength(2);
    expect(rig.server.gets().filter((g) => g.url.includes('part='))).toHaveLength(3);

    rig.server.externalWrite({
      v: 2,
      deviceId: 'dev-b',
      seq: 1,
      delta: {
        counters: emptyCounters(),
        learn: learnDelta({ entries: { [KEY_I]: entry(3) } }),
        settings: null,
      },
    });
    rig.timers.advance(REQUEST_SPACING_MS);
    rig.env.goOnline();
    rig.timers.advance(0);
    await rig.engine.idle();
    expect(rig.server.gets().filter((g) => g.url.includes('part='))).toHaveLength(6);
    expect(await rig.db.get('meta', 'snapshotVersion')).toBe(4);
  });

  it('does nothing for a guest', async () => {
    const db = createMemoryDb();
    const rig = await createRig({ db });
    await sync(rig);
    expect(rig.server.requests).toEqual([]);
  });
});
