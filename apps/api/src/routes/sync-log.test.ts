import { env } from 'cloudflare:workers';
import { encodePage, isObject, isSettings } from '@nekotype/shared/runtime';
import type { LogEvent, LogPage, SyncRequest, ValidSettings } from '@nekotype/shared/types';
import { describe, expect, it } from 'vitest';
import { createApp } from '../app';
import { PULL_PAGE_BYTES, PULL_PAGE_ROWS } from '../db/batches';
import { countingDb, signedInUser } from '../test-support';
import { testDeps } from '../test-deps';

// Sync format 4 (P7 plan, D11–D15; P9 plan, D3): the log as batches, one D1 row per batch, pulls of the rows of
// other devices. The checks common to every request are in `sync.test.ts`.

const START = 1_700_000_000_000;
const A = '11111111-1111-4111-8111-111111111111';
const B = '22222222-2222-4222-8222-222222222222';
const origin = { Origin: 'http://localhost:5173' };

let userCount = 0;
const nextUserId = (): string => `log-user-${(userCount += 1)}`;

type Setup = ReturnType<typeof setup>;

function setup(options: { interval?: string; db?: D1Database } = {}) {
  const { deps, clock } = testDeps({}, START);
  const app = createApp(deps);
  const bindings = {
    ...env,
    SYNC_MIN_INTERVAL_MS: options.interval ?? '0',
    DB: options.db ?? env.DB,
  };
  const call = (path: string, init?: RequestInit) => app.request(path, init, bindings);
  return { call, clock };
}

async function newUser() {
  const id = nextUserId();
  const { cookie } = await signedInUser(env.DB, id, START);
  return { id, cookie };
}

const post = (s: Setup, cookie: string, body: unknown) =>
  s.call('/api/sync', {
    method: 'POST',
    headers: { ...origin, Cookie: cookie, 'content-type': 'application/json' },
    body: typeof body === 'string' ? body : JSON.stringify(body),
  });

const get = (s: Setup, cookie: string, query: string) =>
  s.call(`/api/sync?${query}`, { headers: { Cookie: cookie } });

/** `count` answers of `dev`, `n` from `n0`. */
function page(dev: string, n0: number, count: number, at0 = START): LogPage {
  const events: LogEvent[] = Array.from({ length: count }, (_, index) => ({
    at: at0 + index * 1_000,
    dev,
    n: n0 + index,
    t: 'answer',
    task: 'recall',
    k: 'hiragana:あ',
    ok: index % 3 !== 0,
    ms: 800 + (index % 50),
    hint: false,
    wrong: null,
    alt: null,
    misses: 0,
    w: null,
  }));
  return encodePage(events);
}

function batch(seq: number, over: Partial<SyncRequest> = {}): SyncRequest {
  return {
    v: 4,
    deviceId: A,
    seq,
    after: 0,
    log: page(A, 1 + (seq - 1) * 3, 3),
    settings: null,
    ...over,
  };
}

function settings(updatedAt: number, track: 'hiragana' | 'katakana' = 'hiragana'): ValidSettings {
  return {
    learn: { strictness: 'learner', track, sound: true },
    updatedAt,
  };
}

async function batchRows(userId: string) {
  const { results } = await env.DB.prepare(
    'SELECT id, device_id, seq, log FROM sync_batches WHERE user_id = ? ORDER BY id',
  )
    .bind(userId)
    .all<{ id: number; device_id: string; seq: number; log: string }>();
  return results;
}

async function json(response: Response): Promise<unknown> {
  return response.json();
}

/** Puts a row of another device straight into the table, as an earlier sync of it would have. */
async function seedRow(userId: string, id: number, dev: string, log: string): Promise<void> {
  await env.DB.prepare(
    'INSERT INTO sync_batches (user_id, id, device_id, seq, log, created_at) VALUES (?, ?, ?, ?, ?, 1)',
  )
    .bind(userId, id, dev, id, log)
    .run();
}

describe('POST /api/sync, format 4', () => {
  it('stores a batch as one row, answers the last seq and no more', async () => {
    const { id, cookie } = await newUser();
    const body = batch(1);
    const response = await post(setup(), cookie, body);
    expect(response.status).toBe(200);
    expect(await json(response)).toEqual({ lastSeq: 1, more: false });
    const rows = await batchRows(id);
    expect(rows.map((row) => [row.id, row.device_id, row.seq])).toEqual([[1, A, 1]]);
    expect(JSON.parse(rows[0]?.log ?? 'null')).toEqual(body.log);
  });

  it('writes at most 3 rows in at most 5 statements for 256 KB with settings', async () => {
    const { id, cookie } = await newUser();
    // Settings are updated in place; the first insert also writes the index entry of the key.
    await env.DB.prepare('INSERT INTO user_settings (user_id, json, updated_at) VALUES (?, ?, 0)')
      .bind(id, JSON.stringify(settings(0)))
      .run();
    // The first batch of a device keeps the stored settings (`keepStored`): measure the second.
    expect((await post(setup(), cookie, batch(1))).status).toBe(200);
    const counting = countingDb(env.DB);
    // About 230 KB of log: 4,400 events of ~52 bytes.
    const body = JSON.stringify(batch(2, { log: page(A, 4, 4_400), settings: settings(5) }));
    expect(new TextEncoder().encode(body).length).toBeGreaterThan(200_000);
    expect(new TextEncoder().encode(body).length).toBeLessThanOrEqual(256 * 1024);
    const response = await post(setup({ db: counting.db }), cookie, body);
    expect(response.status).toBe(200);
    // user_stats, sync_batches and user_settings: one row each.
    expect(counting.log.rowsWritten).toBe(3);
    // The session lookup, one read and three writes.
    expect(counting.log.statements).toBe(5);
    expect(await batchRows(id)).toHaveLength(2);
  });

  it('writes 2 rows in 4 statements without settings', async () => {
    const { cookie } = await newUser();
    const counting = countingDb(env.DB);
    await post(setup({ db: counting.db }), cookie, batch(1));
    expect(counting.log.rowsWritten).toBe(2);
    expect(counting.log.statements).toBe(4);
  });

  it('reads a few rows however many the user has: the id comes from the end of the key', async () => {
    const { cookie, id } = await newUser();
    for (let row = 1; row <= 300; row += 1) await seedRow(id, row, B, '{}');
    const counting = countingDb(env.DB);
    expect((await post(setup({ db: counting.db }), cookie, batch(1))).status).toBe(200);
    expect((await batchRows(id)).map((row) => row.id)).toContain(301);
    // A walk of the user's rows would read 300 and more.
    expect(counting.log.rowsRead).toBeLessThan(20);
  });

  it('writes nothing for a seq it has applied, and a resent batch adds no row', async () => {
    const { id, cookie } = await newUser();
    const s = setup();
    await post(s, cookie, batch(1));
    const counting = countingDb(env.DB);
    const again = await post(setup({ db: counting.db }), cookie, batch(1));
    expect(await json(again)).toEqual({ lastSeq: 1, more: false });
    expect(await batchRows(id)).toHaveLength(1);
    const versionOf = async () =>
      (await env.DB.prepare('SELECT version FROM user_stats WHERE user_id = ?').bind(id).first())?.[
        'version'
      ];
    const before = await versionOf();
    await post(s, cookie, batch(1));
    expect(await versionOf()).toBe(before);
  });

  it('is a 409 seq_gap for a seq beyond last + 1', async () => {
    const { cookie } = await newUser();
    const response = await post(setup(), cookie, batch(3));
    expect(response.status).toBe(409);
    expect(await json(response)).toEqual({ error: { code: 'seq_gap', lastSeq: 0 } });
  });

  it('rate-limits only a batch it would apply', async () => {
    const { id, cookie } = await newUser();
    const s = setup({ interval: '5000' });
    expect((await post(s, cookie, batch(1))).status).toBe(200);
    const limited = await post(s, cookie, batch(2));
    expect(limited.status).toBe(429);
    expect(limited.headers.get('Retry-After')).toBe('5');
    expect((await post(s, cookie, batch(1))).status).toBe(200); // applied seq: not limited
    expect(await batchRows(id)).toHaveLength(1);
  });

  it('answers more when another device has rows after `after`, and not for its own', async () => {
    const { id, cookie } = await newUser();
    const s = setup();
    await seedRow(id, 1, B, JSON.stringify(page(B, 1, 2)));
    expect(await json(await post(s, cookie, batch(1, { after: 0 })))).toEqual({
      lastSeq: 1,
      more: true,
    });
    // Rows 1 (B) and 2 (A, just written): after row 1 only the device's own row follows.
    expect(await json(await post(s, cookie, batch(2, { after: 1 })))).toEqual({
      lastSeq: 2,
      more: false,
    });
  });

  it('keeps the account settings on the first batch of a device and takes newer ones later', async () => {
    const { id, cookie } = await newUser();
    const s = setup();
    const track = async (): Promise<string | null> => {
      const row = await env.DB.prepare('SELECT json FROM user_settings WHERE user_id = ?')
        .bind(id)
        .first();
      const parsed: unknown = JSON.parse(String(row?.['json']));
      return isSettings(parsed) ? parsed.learn.track : null;
    };
    await post(s, cookie, batch(1, { settings: settings(10, 'katakana') }));
    await post(s, cookie, {
      ...batch(1, { deviceId: B, log: page(B, 1, 1) }),
      settings: settings(5, 'hiragana'),
    });
    expect(await track()).toBe('katakana');
    await post(s, cookie, batch(2, { settings: settings(20, 'hiragana') }));
    expect(await track()).toBe('hiragana');
    await post(s, cookie, batch(3, { settings: settings(15, 'katakana') }));
    expect(await track()).toBe('hiragana');
  });

  it('takes a batch with settings and no log, and writes no row for it', async () => {
    const { id, cookie } = await newUser();
    const response = await post(setup(), cookie, batch(1, { log: null, settings: settings(1) }));
    expect(response.status).toBe(200);
    expect(await batchRows(id)).toHaveLength(0);
  });

  it('draws the ids per user, increasing, with two users interleaved', async () => {
    const one = await newUser();
    const two = await newUser();
    const s = setup();
    await post(s, one.cookie, batch(1));
    await post(s, two.cookie, batch(1));
    await post(s, one.cookie, batch(2));
    await post(s, two.cookie, batch(2));
    await post(s, two.cookie, batch(3));
    expect((await batchRows(one.id)).map((row) => row.id)).toEqual([1, 2]);
    expect((await batchRows(two.id)).map((row) => row.id)).toEqual([1, 2, 3]);
  });

  it('removes the rows of a deleted account', async () => {
    const { id, cookie } = await newUser();
    await post(setup(), cookie, batch(1));
    const deleted = await setup().call('/api/me', {
      method: 'DELETE',
      headers: { ...origin, Cookie: cookie },
    });
    expect(deleted.status).toBeLessThan(300);
    expect(await batchRows(id)).toHaveLength(0);
  });

  it('rejects v 3, an invalid page, an unknown key and a missing after with 400', async () => {
    const { cookie } = await newUser();
    const s = setup();
    const bad = [
      { ...batch(1), v: 3 },
      { ...batch(1), log: { ...page(A, 1, 1), at0: -1 } },
      { ...batch(1), extra: 1 },
      { ...batch(1), after: undefined },
      { ...batch(1), after: -1 },
      { ...batch(1), after: 1.5 },
      { ...batch(1), seq: 0 },
      { ...batch(1), log: { ...page(A, 1, 1), e: [] } },
      'not json',
    ];
    for (const body of bad) expect((await post(s, cookie, body)).status).toBe(400);
  });

  it('is a 413 above 256 KB', async () => {
    const { cookie } = await newUser();
    const body = JSON.stringify({ ...batch(1), pad: 'x'.repeat(257 * 1024) });
    expect((await post(setup(), cookie, body)).status).toBe(413);
  });

  describe('a lost version', () => {
    async function bump(userId: string): Promise<void> {
      await env.DB.prepare('UPDATE user_stats SET version = version + 1 WHERE user_id = ?')
        .bind(userId)
        .run();
    }

    it('is retried once and adds exactly one row, in at most 9 statements', async () => {
      const { id, cookie } = await newUser();
      const counting = countingDb(env.DB, { beforeUpdate: () => bump(id) });
      const response = await post(setup({ db: counting.db }), cookie, batch(1));
      expect(response.status).toBe(200);
      expect(await json(response)).toEqual({ lastSeq: 1, more: false });
      expect(await batchRows(id)).toHaveLength(1);
      expect(counting.log.statements).toBeLessThanOrEqual(9);
    });

    it('is a 503 conflict when lost twice and leaves no row; a resend then succeeds', async () => {
      const { id, cookie } = await newUser();
      const counting = countingDb(env.DB, { beforeEveryUpdate: () => bump(id) });
      const lost = await post(setup({ db: counting.db }), cookie, batch(1));
      expect(lost.status).toBe(503);
      expect(lost.headers.get('Retry-After')).toBe('5');
      expect(await batchRows(id)).toHaveLength(0);
      expect((await post(setup(), cookie, batch(1))).status).toBe(200);
      expect(await batchRows(id)).toHaveLength(1);
    });
  });
});

describe('GET /api/sync?deviceId=&after=', () => {
  it('skips own rows, advances last past them and returns the settings', async () => {
    const { id, cookie } = await newUser();
    const s = setup();
    const other = page(B, 1, 2);
    await seedRow(id, 1, A, JSON.stringify(page(A, 1, 1)));
    await seedRow(id, 2, B, JSON.stringify(other));
    await seedRow(id, 3, A, JSON.stringify(page(A, 2, 1)));
    await env.DB.prepare('INSERT INTO user_settings (user_id, json, updated_at) VALUES (?, ?, 3)')
      .bind(id, JSON.stringify(settings(3)))
      .run();
    const response = await get(s, cookie, `deviceId=${A}&after=0`);
    expect(response.status).toBe(200);
    expect(response.headers.get('content-type')).toContain('application/json');
    expect(await json(response)).toEqual({
      last: 3,
      more: false,
      settings: settings(3),
      rows: [{ id: 2, log: other }],
    });
    expect(await json(await get(s, cookie, `deviceId=${A}&after=2`))).toEqual({
      last: 3,
      more: false,
      settings: settings(3),
      rows: [],
    });
    expect(await json(await get(s, cookie, `deviceId=${A}&after=3`))).toEqual({
      last: 3,
      more: false,
      settings: settings(3),
      rows: [],
    });
  });

  it('serves a row of format 3 as it was stored', async () => {
    const { id, cookie } = await newUser();
    const stored = JSON.stringify({
      dev: B,
      n0: 1,
      at0: START,
      e: [[0, 'a', 'recall', 'hiragana:あ', 1, 800, 0, '', '']],
    });
    await seedRow(id, 1, B, stored);
    const response = await get(setup(), cookie, `deviceId=${A}&after=0`);
    expect(await response.text()).toContain(`"log":${stored}`);
  });

  it('answers null settings and an empty page for a new account', async () => {
    const { cookie } = await newUser();
    expect(await json(await get(setup(), cookie, `deviceId=${A}&after=0`))).toEqual({
      last: 0,
      more: false,
      settings: null,
      rows: [],
    });
  });

  it('walks at most PULL_PAGE_ROWS rows, own ones included, and says more', async () => {
    const { id, cookie } = await newUser();
    const text = JSON.stringify(page(B, 1, 1));
    await env.DB.batch(
      Array.from({ length: PULL_PAGE_ROWS + 5 }, (_, index) =>
        env.DB.prepare(
          'INSERT INTO sync_batches (user_id, id, device_id, seq, log, created_at) VALUES (?, ?, ?, ?, ?, 1)',
        ).bind(id, index + 1, index % 2 === 0 ? A : B, index + 1, text),
      ),
    );
    const first = await json(await get(setup(), cookie, `deviceId=${A}&after=0`));
    expect(first).toMatchObject({ last: PULL_PAGE_ROWS, more: true });
    expect(isObject(first) && Array.isArray(first['rows']) ? first['rows'].length : -1).toBe(
      PULL_PAGE_ROWS / 2,
    );
    const second = await json(await get(setup(), cookie, `deviceId=${A}&after=${PULL_PAGE_ROWS}`));
    expect(second).toMatchObject({ last: PULL_PAGE_ROWS + 5, more: false });
  });

  it('stops at the byte limit, always takes one row and continues from last', async () => {
    const { id, cookie } = await newUser();
    // Three rows of about 120 KB: two do not fit under 256 KB together with a third.
    const big = JSON.stringify(page(B, 1, 2_300));
    expect(big.length).toBeGreaterThan(100_000);
    for (const row of [1, 2, 3]) await seedRow(id, row, B, big);
    const s = setup();
    const first = await json(await get(s, cookie, `deviceId=${A}&after=0`));
    expect(first).toMatchObject({ last: 2, more: true });
    const second = await json(await get(s, cookie, `deviceId=${A}&after=2`));
    expect(second).toMatchObject({ last: 3, more: false });
    expect(PULL_PAGE_BYTES).toBe(256 * 1024);
  });

  it('takes a single row larger than the limit', async () => {
    const { id, cookie } = await newUser();
    const huge = JSON.stringify(page(B, 1, 7_000));
    expect(new TextEncoder().encode(huge).length).toBeGreaterThan(PULL_PAGE_BYTES);
    await seedRow(id, 1, B, huge);
    await seedRow(id, 2, B, JSON.stringify(page(B, 7_001, 1)));
    const first = await json(await get(setup(), cookie, `deviceId=${A}&after=0`));
    expect(first).toMatchObject({ last: 1, more: true });
  });

  it('shows no row of another user', async () => {
    const one = await newUser();
    const two = await newUser();
    await seedRow(two.id, 1, B, JSON.stringify(page(B, 1, 1)));
    expect(await json(await get(setup(), one.cookie, `deviceId=${A}&after=0`))).toMatchObject({
      last: 0,
      rows: [],
    });
  });

  it('is a 400 for a bad deviceId or after, or with both after and part, and a 401 without a session', async () => {
    const { cookie } = await newUser();
    const s = setup();
    for (const query of [
      'deviceId=x&after=0',
      `deviceId=${A}&after=-1`,
      `deviceId=${A}&after=1.5`,
      `deviceId=${A}&after=abc`,
      `deviceId=${A}&after=`,
      `deviceId=${A}&after=0&part=rest`,
    ]) {
      expect([query, (await get(s, cookie, query)).status]).toEqual([query, 400]);
    }
    const anonymous = await s.call(`/api/sync?deviceId=${A}&after=0`);
    expect(anonymous.status).toBe(401);
  });
});
