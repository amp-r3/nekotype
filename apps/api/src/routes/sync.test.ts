import { env } from 'cloudflare:workers';
import type { SyncRequest } from '@nekotype/shared/types';
import { describe, expect, it } from 'vitest';
import { createApp } from '../app';
import { signedInUser } from '../test-support';
import { testDeps } from '../test-deps';

// The checks every request of `/api/sync` passes before its format matters, and the end of format
// 2 (P7 plan, D15, PR 13). The behaviour of format 3 is in `sync-log.test.ts`.

const START = 1_700_000_000_000;
const A = '11111111-1111-4111-8111-111111111111';
const origin = { Origin: 'http://localhost:5173' };

let userCount = 0;
const nextUserId = (): string => `sync-user-${(userCount += 1)}`;

type Setup = ReturnType<typeof setup>;

function setup() {
  const { deps } = testDeps({}, START);
  const app = createApp(deps);
  const bindings = { ...env, SYNC_MIN_INTERVAL_MS: '0' };
  return { call: (path: string, init?: RequestInit) => app.request(path, init, bindings) };
}

async function newUser() {
  const { cookie } = await signedInUser(env.DB, nextUserId(), START);
  return { cookie };
}

const post = (s: Setup, cookie: string, body: unknown, headers: Record<string, string> = origin) =>
  s.call('/api/sync', {
    method: 'POST',
    headers: { ...headers, Cookie: cookie, 'content-type': 'application/json' },
    body: typeof body === 'string' ? body : JSON.stringify(body),
  });

const get = (s: Setup, cookie: string, query: string) =>
  s.call(`/api/sync?${query}`, { headers: { Cookie: cookie } });

const batch = (): SyncRequest => ({
  v: 3,
  deviceId: A,
  seq: 1,
  after: 0,
  log: null,
  settings: null,
});

const deltaOfFormat2 = {
  v: 2,
  deviceId: A,
  seq: 1,
  delta: {
    counters: { started: 0, finished: 0 },
    learn: {
      entries: {},
      unlocked: { hiragana: [], katakana: [] },
      recent: {},
      stats: {},
      activeDays: [],
      recallBuckets: { hiragana: {}, katakana: {} },
    },
    settings: null,
  },
};

const invalid = { error: { code: 'invalid_body' } };

describe('POST /api/sync: checks', () => {
  it('answers 403 without the right Origin, before the session', async () => {
    const s = setup();
    const { cookie } = await newUser();
    expect((await post(s, cookie, batch(), {})).status).toBe(403);
    expect((await post(s, '', batch(), { Origin: 'https://evil.example' })).status).toBe(403);
    const response = await post(s, cookie, batch(), {});
    expect(await response.json()).toEqual({ error: { code: 'bad_origin' } });
  });

  it('answers 401 without a session, to GET and to POST', async () => {
    const s = setup();
    expect((await post(s, '', batch())).status).toBe(401);
    expect((await get(s, '', `deviceId=${A}&after=0`)).status).toBe(401);
    expect((await post(s, 'nt_session=unknown', batch())).status).toBe(401);
  });

  it('answers 413 over 256 KB, before the session and the schema', async () => {
    const s = setup();
    const response = await post(s, '', `{"padding":"${'x'.repeat(300_000)}"}`);
    expect(response.status).toBe(413);
    expect(await response.json()).toEqual({ error: { code: 'too_large' } });
  });

  it.each([
    ['not JSON', '{'],
    ['an empty body', ''],
    ['an array', '[]'],
    ['no version', { ...batch(), v: undefined }],
    ['the version of P5', { ...batch(), v: 1 }],
    ['format 2, a well-formed batch of deltas', deltaOfFormat2],
  ])('answers 400 for %s', async (_name, body) => {
    const s = setup();
    const { cookie } = await newUser();
    const response = await post(s, cookie, body);
    expect(response.status).toBe(400);
    expect(await response.json()).toEqual(invalid);
  });

  it('applies a batch of format 3', async () => {
    const s = setup();
    const { cookie } = await newUser();
    const response = await post(s, cookie, batch());
    expect(response.status).toBe(200);
    expect(await response.json()).toEqual({ lastSeq: 1, more: false });
  });
});

describe('GET /api/sync: format 2 is gone', () => {
  it.each([
    ['without after', `deviceId=${A}`],
    ['part=rest without after', `deviceId=${A}&part=rest`],
    ['part=recent without after', `deviceId=${A}&part=recent`],
    ['part=all', `deviceId=${A}&part=all`],
    ['part with after', `deviceId=${A}&after=0&part=rest`],
    ['no query', ''],
  ])('answers 400 %s', async (_name, query) => {
    const s = setup();
    const { cookie } = await newUser();
    const response = await get(s, cookie, query);
    expect(response.status).toBe(400);
    expect(await response.json()).toEqual(invalid);
  });

  it('still pulls with after', async () => {
    const s = setup();
    const { cookie } = await newUser();
    expect((await get(s, cookie, `deviceId=${A}&after=0`)).status).toBe(200);
  });
});
