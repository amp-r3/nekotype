import { describe, expect, it } from 'vitest';
import type { PendingBatch } from '../lib/stored';
import type { SyncRequest, ValidSettings } from '@nekotype/shared/types';
import { decodePage, encodePage, isObject, isLogPage } from '@nekotype/shared/runtime';
import { createMemoryDb } from '@/shared/lib';
import {
  AFTER_WORK_MS,
  CATCH_UP_SPACING_MS,
  KEEPALIVE_MAX_BYTES,
  REQUEST_SPACING_MS,
} from './engine';
import {
  LOG_DEV,
  OTHER_DEV,
  TEST_PULL_ROWS,
  createFakeServer,
  createRig,
  appendOwn,
  createTestLocks,
  errorResponse,
  eventsOf,
  seedOwn,
  settingsAt,
  signedInDb,
} from './test-util';
import type { Rig } from './test-util';

const isSyncRequest = (value: unknown): value is SyncRequest =>
  isObject(value) && value['v'] === 4 && typeof value['seq'] === 'number';

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

const eventCount = (request: SyncRequest): number => request.log?.e.length ?? 0;

/** A settings document of the versions before ADR 115, with the target answer time. */
const withTargetMs = (settings: ValidSettings): unknown => ({
  ...settings,
  learn: { ...settings.learn, targetMs: 1500 },
});

describe('a batch', () => {
  it('carries the own events and the changed settings, and the acknowledgement records them', async () => {
    const rig = await createRig();
    await seedOwn(rig.db, 3);
    await rig.db.put('settings', 'current', settingsAt(900));
    await sync(rig);

    const [first] = rig.server.posts();
    expect(first).toBeDefined();
    const sent = body(first ?? { body: null });
    expect(sent.seq).toBe(1);
    expect(sent.deviceId).toBe('dev-a');
    expect(sent.after).toBe(0);
    expect(sent.settings?.updatedAt).toBe(900);
    expect(sent.log?.dev).toBe(LOG_DEV);
    expect(sent.log?.n0).toBe(1);
    expect(eventCount(sent)).toBe(3);
    expect(rig.server.events().map((e) => e.n)).toEqual([1, 2, 3]);
    expect(await rig.db.get('outbox', 'current')).toBeUndefined();
    expect(await rig.db.get('meta', 'sentN')).toBe(3);
    expect(await rig.db.get('meta', 'lastSeq')).toBe(1);
  });

  it('sends only the events after sentN', async () => {
    const rig = await createRig();
    await seedOwn(rig.db, 5);
    await rig.db.put('meta', 'sentN', 3);
    await sync(rig);

    const sent = body(rig.server.posts()[0] ?? { body: null });
    expect(sent.log?.n0).toBe(4);
    expect(eventCount(sent)).toBe(2);
    expect(await rig.db.get('meta', 'sentN')).toBe(5);
  });

  it('is the longest prefix within 256 KB, and the rest follows 5 seconds later', async () => {
    const rig = await createRig();
    await seedOwn(rig.db, 7000);

    await sync(rig);

    const first = body(rig.server.posts()[0] ?? { body: null });
    const bytes = new TextEncoder().encode(rig.server.posts()[0]?.body ?? '').length;
    expect(bytes).toBeLessThanOrEqual(256 * 1024);
    expect(eventCount(first)).toBeGreaterThan(1000);
    expect(eventCount(first)).toBeLessThan(7000);
    expect(await rig.db.get('meta', 'sentN')).toBe(eventCount(first));
    expect(rig.timers.pending).toEqual([CATCH_UP_SPACING_MS]);

    rig.timers.advance(CATCH_UP_SPACING_MS);
    await rig.engine.idle();
    const second = body(rig.server.posts()[1] ?? { body: null });
    expect(second.log?.n0).toBe(eventCount(first) + 1);
    expect(eventCount(first) + eventCount(second)).toBe(7000);
    expect(await rig.db.get('meta', 'sentN')).toBe(7000);
  });

  it('sends settings alone when there are no events', async () => {
    const rig = await createRig();
    await rig.db.put('settings', 'current', settingsAt(900));
    await sync(rig);
    const sent = body(rig.server.posts()[0] ?? { body: null });
    expect(sent.log).toBeNull();
    expect(sent.settings?.updatedAt).toBe(900);
    expect(await rig.db.get('meta', 'sentN')).toBeUndefined();
  });

  it('sends nothing when nothing changed', async () => {
    const rig = await createRig();
    await sync(rig);
    expect(rig.server.posts()).toEqual([]);
  });

  it('carries `after` = pulledId', async () => {
    const rig = await createRig();
    await rig.db.put('meta', 'pulledId', 12);
    await seedOwn(rig.db, 1);
    await sync(rig);
    expect(body(rig.server.posts()[0] ?? { body: null }).after).toBe(12);
  });
});

describe('an unacknowledged batch', () => {
  it('is followed by the events that came after it was built', async () => {
    const rig = await createRig();
    await seedOwn(rig.db, 2);
    rig.server.forceNetworkError();
    await sync(rig);
    // A second session ends while the first batch waits in the outbox.
    await seedOwn(rig.db, 5);
    rig.timers.advance(REQUEST_SPACING_MS);
    rig.env.goOnline();
    rig.timers.advance(0);
    await rig.engine.idle();
    expect(await rig.db.get('meta', 'sentN')).toBe(2);
    expect(rig.timers.pending).toEqual([CATCH_UP_SPACING_MS]);

    rig.timers.advance(CATCH_UP_SPACING_MS);
    await rig.engine.idle();
    expect(await rig.db.get('meta', 'sentN')).toBe(5);
    expect(rig.server.events().map((e) => e.n)).toEqual([1, 2, 3, 4, 5]);
  });

  it('is resent unchanged', async () => {
    const rig = await createRig();
    await seedOwn(rig.db, 2);
    rig.server.forceNetworkError();

    await sync(rig);
    expect(await rig.db.get('outbox', 'current')).toBeDefined();
    expect(await rig.db.get('meta', 'sentN')).toBeUndefined();
    expect(rig.server.posts()).toHaveLength(1);
    expect(rig.server.events()).toEqual([]);

    rig.timers.advance(REQUEST_SPACING_MS);
    rig.env.goOnline();
    rig.timers.advance(0);
    await rig.engine.idle();

    expect(rig.server.posts()).toHaveLength(2);
    expect(rig.server.posts()[1]?.body).toBe(rig.server.posts()[0]?.body);
    expect(await rig.db.get('outbox', 'current')).toBeUndefined();
    expect(rig.server.events()).toHaveLength(2);
  });

  it('is not applied twice when the acknowledgement was lost', async () => {
    const rig = await createRig();
    await seedOwn(rig.db, 2);
    // The server applies the batch, the answer never arrives.
    rig.server.onRequest((request) => {
      if (request.method === 'POST' && rig.server.posts().length === 1) {
        rig.server.externalWrite('dev-a', eventsOf(LOG_DEV, 1, 2));
        rig.server.setLastSeq('dev-a', 1);
      }
    });
    rig.server.force(() => {
      throw new TypeError('Failed to fetch');
    });
    await sync(rig);
    rig.server.onRequest(null);
    rig.timers.advance(REQUEST_SPACING_MS);
    rig.env.goOnline();
    rig.timers.advance(0);
    await rig.engine.idle();

    expect(rig.server.rows()).toHaveLength(1);
    expect(await rig.db.get('meta', 'sentN')).toBe(2);
    expect(await rig.db.get('outbox', 'current')).toBeUndefined();
  });
});

describe('settings', () => {
  it('the acknowledgement keeps a document that has not changed since the batch', async () => {
    const rig = await createRig();
    await rig.db.put('settings', 'current', settingsAt(500));
    await rig.db.put('meta', 'lastSeq', 1);
    rig.server.setLastSeq('dev-a', 1);
    await sync(rig);

    expect(await rig.db.get('settings', 'current')).toEqual(settingsAt(500));
    expect(await rig.db.get('meta', 'settingsSyncedAt')).toBe(500);
  });

  it('keeps settings that changed after the batch was built, and sends them next', async () => {
    const rig = await createRig();
    await rig.db.put('settings', 'current', settingsAt(100));
    await rig.db.put('meta', 'lastSeq', 1);
    rig.server.setLastSeq('dev-a', 1);
    rig.server.onRequest(() => {
      void rig.db.put('settings', 'current', settingsAt(300));
    });
    await sync(rig);

    expect(await rig.db.get('settings', 'current')).toEqual(settingsAt(300));
    expect(await rig.db.get('meta', 'settingsSyncedAt')).toBe(100);
    rig.server.onRequest(null);
    rig.request();
    rig.timers.advance(AFTER_WORK_MS);
    await rig.engine.idle();
    expect(body(rig.server.posts()[1] ?? { body: null }).settings?.updatedAt).toBe(300);
    expect(rig.server.settings()?.updatedAt).toBe(300);
  });

  it('the account settings win on the first batch of a sign-in: the pull brings them', async () => {
    const rig = await createRig();
    rig.server.setSettings(settingsAt(40));
    await rig.db.put('settings', 'current', settingsAt(700));

    await sync(rig);

    expect(await rig.db.get('settings', 'current')).toEqual(settingsAt(40));
    expect(await rig.db.get('meta', 'settingsSyncedAt')).toBe(40);
    expect(rig.channels.settings.posts).toEqual(['change']);
  });

  describe('of an earlier version, with the target answer time (ADR 115)', () => {
    it('sends a local document without it', async () => {
      const rig = await createRig();
      await rig.db.put('settings', 'current', withTargetMs(settingsAt(500)));
      await rig.db.put('meta', 'lastSeq', 1);
      rig.server.setLastSeq('dev-a', 1);
      await sync(rig);

      expect(body(rig.server.posts()[0] ?? { body: null }).settings).toEqual(settingsAt(500));
      expect(rig.server.settings()).toEqual(settingsAt(500));
    });

    it('sends an outbox batch without it and clears the outbox', async () => {
      const rig = await createRig();
      await rig.db.put('outbox', 'current', {
        seq: 1,
        request: {
          v: 4,
          deviceId: 'dev-a',
          seq: 1,
          after: 0,
          log: encodePage(eventsOf(LOG_DEV, 1, 1)),
          settings: withTargetMs(settingsAt(500)),
        },
      });
      await sync(rig);

      expect(rig.server.posts()).toHaveLength(1);
      expect(body(rig.server.posts()[0] ?? { body: null }).settings).toEqual(settingsAt(500));
      expect(await rig.db.get('outbox', 'current')).toBeUndefined();
      expect(rig.server.events()).toHaveLength(1);
    });

    it('takes a pulled document without it and goes on syncing', async () => {
      const { syncStatus } = await import('./status');
      const rig = await createRig();
      rig.server.force(
        () =>
          new Response(
            JSON.stringify({
              last: 0,
              more: false,
              settings: withTargetMs(settingsAt(40)),
              rows: [],
            }),
            { status: 200, headers: { 'Content-Type': 'application/json' } },
          ),
      );
      await sync(rig);

      expect(await rig.db.get('meta', 'syncBlockedAtVersion')).toBeUndefined();
      expect(await rig.db.get('settings', 'current')).toEqual(settingsAt(40));
      expect(syncStatus.value).toBe('synced');
    });
  });

  it('is synced when the settings carry a fractional updatedAt, as the clock gives them', async () => {
    const rig = await createRig();
    rig.server.setSettings(settingsAt(40.4));
    await rig.db.put('settings', 'current', settingsAt(700.5));
    await seedOwn(rig.db, 1);
    const { syncStatus } = await import('./status');

    await sync(rig);

    expect(await rig.db.get('meta', 'settingsSyncedAt')).toBe(40.4);
    expect(syncStatus.value).toBe('synced');
  });
});

describe('the status', () => {
  it('is pending while own events are unsent and synced after', async () => {
    const { syncStatus } = await import('./status');
    const rig = await createRig();
    await seedOwn(rig.db, 2);
    rig.engine.start();
    rig.request();
    await rig.engine.idle();
    expect(syncStatus.value).toBe('pending');
    rig.timers.advance(AFTER_WORK_MS);
    await rig.engine.idle();
    expect(syncStatus.value).toBe('synced');
  });
});

describe('failed requests', () => {
  it('a 409 rewrites the seq of the outbox to lastSeq + 1 and resends at once', async () => {
    const rig = await createRig();
    await seedOwn(rig.db, 2);
    await rig.db.put('meta', 'lastSeq', 7);
    rig.server.setLastSeq('dev-a', 2);

    await sync(rig);

    const seqs = rig.server.posts().map((p) => body(p).seq);
    expect(seqs).toEqual([8, 3]);
    expect(rig.server.lastSeq('dev-a')).toBe(3);
    expect(await rig.db.get('meta', 'lastSeq')).toBe(3);
    expect(await rig.db.get('outbox', 'current')).toBeUndefined();
    expect(rig.server.events()).toHaveLength(2);
  });

  it.each([
    ['429', () => errorResponse(429, 'rate_limited', { retryAfter: 12 })],
    ['503 with Retry-After', () => errorResponse(503, 'conflict', { retryAfter: 12 })],
  ])('a %s waits for Retry-After, then retries and drops nothing', async (_name, response) => {
    const rig = await createRig();
    await seedOwn(rig.db, 1);
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
    await seedOwn(rig.db, 1);
    rig.server.forceNetworkError();

    await sync(rig);

    expect(await rig.db.get('outbox', 'current')).toBeDefined();
    expect(syncStatus.value).toBe('offline');
    rig.timers.advance(REQUEST_SPACING_MS);
    rig.env.goOnline();
    rig.timers.advance(0);
    await rig.engine.idle();
    expect(rig.server.events()).toHaveLength(1);
    expect(syncStatus.value).toBe('synced');
  });

  it('a 5xx keeps the batch and sets no timer', async () => {
    const rig = await createRig();
    await seedOwn(rig.db, 1);
    rig.server.force(() => errorResponse(503, 'unavailable'));

    await sync(rig);

    expect(await rig.db.get('outbox', 'current')).toBeDefined();
    expect(rig.timers.pending).toEqual([]);
  });

  it('a 401 sets sessionExpired, tells the user signals and stops syncing', async () => {
    const { syncStatus } = await import('./status');
    const rig = await createRig();
    await seedOwn(rig.db, 1);
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
      await seedOwn(rig.db, 1);
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

  it('a pulled page that fails its guard blocks syncing', async () => {
    const { syncStatus } = await import('./status');
    const rig = await createRig();
    rig.server.force(
      () =>
        new Response(JSON.stringify({ last: 1, more: false, settings: null, rows: [{ id: 1 }] }), {
          status: 200,
          headers: { 'Content-Type': 'application/json' },
        }),
    );

    await sync(rig);

    expect(await rig.db.get('meta', 'syncBlockedAtVersion')).toBe('v1');
    expect(syncStatus.value).toBe('blocked');
    expect(await rig.db.getAll('log')).toEqual([]);
    expect(rig.reloads.count).toBe(0);
  });
});

describe('the pull', () => {
  it('on start with nothing to send stores the rows of other devices and reads the log again', async () => {
    const rig = await createRig();
    const theirs = eventsOf(OTHER_DEV, 1, 2);
    rig.server.externalWrite('dev-b', theirs);

    await sync(rig);

    expect(rig.server.gets()).toHaveLength(1);
    expect(rig.server.gets()[0]?.url).toBe('/api/sync?deviceId=dev-a&after=0');
    const stored = await rig.db.get('log', 'row:000000000001');
    expect(isLogPage(stored)).toBe(true);
    expect(decodePage(stored)).toEqual(theirs);
    expect(await rig.db.get('meta', 'pulledId')).toBe(1);
    expect(rig.reloads.count).toBe(1);
    expect(rig.channels.learn.posts).toEqual([{ kind: 'pull' }]);
  });

  it('walks the pages until more is false', async () => {
    const rig = await createRig();
    const rows = TEST_PULL_ROWS * 2 + 1;
    for (let i = 0; i < rows; i += 1)
      rig.server.externalWrite('dev-b', eventsOf(OTHER_DEV, i + 1, 1));

    await sync(rig);

    expect(rig.server.gets()).toHaveLength(3);
    expect((await rig.db.getAll('log')).length).toBe(rows);
    expect(await rig.db.get('meta', 'pulledId')).toBe(rows);
    // One read of the log for the whole pull.
    expect(rig.reloads.count).toBe(1);
  });

  it('reads nothing again when no row arrived', async () => {
    const rig = await createRig();
    await sync(rig);
    expect(rig.server.gets()).toHaveLength(1);
    expect(rig.reloads.count).toBe(0);
    expect(rig.channels.learn.posts).toEqual([]);
  });

  it('follows an acknowledgement that says more', async () => {
    const rig = await createRig();
    rig.server.externalWrite('dev-b', eventsOf(OTHER_DEV, 1, 1));
    await seedOwn(rig.db, 1);

    await sync(rig);

    expect(rig.server.posts()).toHaveLength(1);
    expect(rig.server.gets()).toHaveLength(1);
    expect(await rig.db.get('meta', 'pulledId')).toBe(2);
    // The device's own row is walked and skipped: it is not stored.
    expect(await rig.db.get('log', 'row:000000000002')).toBeUndefined();
    expect(await rig.db.get('log', 'row:000000000001')).toBeDefined();
    expect(rig.reloads.count).toBe(1);
  });

  it('does not pull after an acknowledgement without more', async () => {
    const rig = await createRig();
    await seedOwn(rig.db, 1);
    await sync(rig);
    expect(rig.server.gets()).toEqual([]);
  });

  it('on online asks again from pulledId', async () => {
    const rig = await createRig();
    await sync(rig);
    rig.server.externalWrite('dev-b', eventsOf(OTHER_DEV, 1, 1));
    rig.timers.advance(REQUEST_SPACING_MS);
    rig.env.goOnline();
    rig.timers.advance(0);
    await rig.engine.idle();
    expect(rig.server.gets()[1]?.url).toBe('/api/sync?deviceId=dev-a&after=0');
    expect(await rig.db.get('meta', 'pulledId')).toBe(1);
    rig.timers.advance(REQUEST_SPACING_MS);
    rig.env.goOnline();
    rig.timers.advance(0);
    await rig.engine.idle();
    expect(rig.server.gets()[2]?.url).toBe('/api/sync?deviceId=dev-a&after=1');
  });
});

describe('spacing', () => {
  it('sends a batch 10 seconds after the work ends, once for several triggers', async () => {
    const rig = await createRig();
    await sync(rig);
    await seedOwn(rig.db, 1);
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
    await seedOwn(rig.db, 1);
    await sync(rig);
    expect(rig.server.posts()).toHaveLength(1);

    await seedOwn(rig.db, 2);
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
  it('sends the events with keepalive', async () => {
    const rig = await createRig();
    await seedOwn(rig.db, 2);
    rig.engine.start();

    rig.env.hide();
    await rig.engine.idle();
    await new Promise((resolve) => setTimeout(resolve, 0));
    await rig.engine.idle();

    const [post] = rig.server.posts();
    expect(post?.keepalive).toBe(true);
    expect(await rig.db.get('outbox', 'current')).toBeUndefined();
  });

  it('builds the batch within 60 KB', async () => {
    const rig = await createRig();
    await seedOwn(rig.db, 3000);
    rig.engine.start();

    rig.env.hide();
    await new Promise((resolve) => setTimeout(resolve, 0));
    await rig.engine.idle();

    const post = rig.server.posts()[0];
    expect(post?.keepalive).toBe(true);
    expect(new TextEncoder().encode(post?.body ?? '').length).toBeLessThanOrEqual(
      KEEPALIVE_MAX_BYTES,
    );
    const sent = body(post ?? { body: null });
    expect(eventCount(sent)).toBeLessThan(3000);
  });

  it('resends an outbox within 60 KB, and nothing above it', async () => {
    const small = await createRig();
    await sync(small);
    const outbox: PendingBatch = {
      seq: 1,
      request: {
        v: 4,
        deviceId: 'dev-a',
        seq: 1,
        after: 0,
        log: encodePage(eventsOf(LOG_DEV, 1, 1)),
        settings: null,
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
    const request: SyncRequest = { ...outbox.request, log: encodePage(eventsOf(LOG_DEV, 1, 3000)) };
    await big.db.put('outbox', 'current', { ...outbox, request });
    expect(JSON.stringify(request).length).toBeGreaterThan(KEEPALIVE_MAX_BYTES);
    big.env.hide();
    await new Promise((resolve) => setTimeout(resolve, 0));
    await big.engine.idle();
    expect(big.server.posts()).toHaveLength(0);
  });

  it('sends nothing when the lock is held by a running sync', async () => {
    const rig = await createRig();
    await seedOwn(rig.db, 1);
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
    await seedOwn(db, 2);
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
  it('exchange their events', async () => {
    const server = createFakeServer();
    const a = await createRig({ db: await signedInDb('dev-a'), server });
    const b = await createRig({ db: await signedInDb('dev-b'), server });
    await seedOwn(a.db, 3, 1, LOG_DEV);
    await seedOwn(b.db, 2, 1, OTHER_DEV);

    await sync(a);
    await sync(b);
    // A has nothing to send: on `online` it reads what B wrote.
    a.timers.advance(REQUEST_SPACING_MS);
    a.env.goOnline();
    a.timers.advance(0);
    await a.engine.idle();

    expect(server.events()).toHaveLength(5);
    const pulledByA = (await a.db.getAll('log'))
      .flatMap((page) => decodePage(page) ?? [])
      .filter((e) => e.dev === OTHER_DEV);
    expect(pulledByA.map((e) => e.n)).toEqual([1, 2]);
    const pulledByB = (await b.db.getAll('log'))
      .flatMap((page) => decodePage(page) ?? [])
      .filter((e) => e.dev === LOG_DEV);
    expect(pulledByB.map((e) => e.n)).toEqual([1, 2, 3]);
    expect(a.reloads.count).toBe(1);
    expect(b.reloads.count).toBe(1);
  });
});

describe('two devices with failed requests', () => {
  // A small seeded generator: the failures fall in the same places on every run.
  const seeded = (seed: number): (() => number) => {
    let x = seed;
    return () => {
      x = (x * 1_664_525 + 1_013_904_223) % 4_294_967_296;
      return x / 4_294_967_296;
    };
  };

  it.each([1, 2, 3, 4, 5])(
    'converge on every event after failed requests and lost answers (seed %i)',
    async (seed) => {
      const random = seeded(seed);
      const server = createFakeServer();
      const a = await createRig({ db: await signedInDb('dev-a'), server });
      const b = await createRig({ db: await signedInDb('dev-b'), server });
      const rigs = [
        { rig: a, dev: LOG_DEV },
        { rig: b, dev: OTHER_DEV },
      ];
      for (const { rig } of rigs) rig.engine.start();

      for (let round = 0; round < 8; round += 1) {
        for (const { rig, dev } of rigs) {
          await appendOwn(rig.db, 1 + Math.floor(random() * 40), dev);
          const roll = random();
          if (roll < 0.25) server.forceNetworkError();
          else if (roll < 0.5) server.loseAcks(1);
          rig.request();
          rig.timers.advance(10_000);
          await rig.engine.idle();
          rig.env.goOnline();
          rig.timers.advance(10_000);
          await rig.engine.idle();
        }
      }
      // Quiet: every pending batch and catch-up goes out, and each device reads the other's rows.
      for (let i = 0; i < 6; i += 1) {
        for (const { rig } of rigs) {
          rig.env.goOnline();
          rig.timers.advance(10_000);
          await rig.engine.idle();
        }
      }

      const key = (e: { dev: string; n: number }): string => `${e.dev}:${String(e.n)}`;
      const onServer = new Set(server.events().map(key));
      // Each batch reached the server once: no event is stored twice.
      expect(onServer.size).toBe(server.events().length);
      expect(onServer.size).toBeGreaterThan(100);
      for (const { rig } of rigs) {
        const stored = (await rig.db.getAll('log')).flatMap((page) => decodePage(page) ?? []);
        expect(new Set(stored.map(key))).toEqual(onServer);
        expect(await rig.db.get('outbox', 'current')).toBeUndefined();
      }
    },
  );
});

describe('a guest', () => {
  it('does nothing', async () => {
    const db = createMemoryDb();
    const rig = await createRig({ db });
    await sync(rig);
    expect(rig.server.requests).toEqual([]);
  });
});
