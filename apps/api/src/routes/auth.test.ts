import { env } from 'cloudflare:workers';
import { beforeEach, describe, expect, it } from 'vitest';
import { hashToken } from '../auth/session';
import { createApp } from '../app';
import type { OAuthProfile } from '../env';
import { testDeps } from '../test-deps';

const DAY = 24 * 60 * 60 * 1000;
const origin = { Origin: 'http://localhost:5173' };

const alice: OAuthProfile = {
  providerUserId: 'g-1',
  email: 'Alice@Example.com',
  displayName: 'Alice',
  avatarUrl: 'https://img.example/alice.png',
};
const profiles = {
  'google-alice': alice,
  'github-alice': { ...alice, providerUserId: 'gh-1', displayName: 'alice-gh' },
  'github-unverified': {
    providerUserId: 'gh-2',
    email: null,
    displayName: 'Bob',
    avatarUrl: null,
  },
  'github-unverified-2': {
    providerUserId: 'gh-3',
    email: null,
    displayName: 'Bob again',
    avatarUrl: null,
  },
};

function setup(environment: Record<string, string | undefined> = {}) {
  const { deps, clock } = testDeps(profiles);
  const app = createApp(deps);
  const bindings = { ...env, ...environment };
  const call = (path: string, init?: RequestInit) => app.request(path, init, bindings);
  return { call, clock };
}

/** The `name=value` pair and the attributes of every cookie a response sets. */
function cookiesOf(response: Response): Map<string, { value: string; attributes: string }> {
  const cookies = new Map<string, { value: string; attributes: string }>();
  for (const line of response.headers.getSetCookie()) {
    const [pair = '', ...attributes] = line.split('; ');
    const at = pair.indexOf('=');
    cookies.set(pair.slice(0, at), {
      value: pair.slice(at + 1),
      attributes: attributes.join('; '),
    });
  }
  return cookies;
}

/** Starts a sign-in and returns the cookie header and the state the callback must echo. */
async function begin(call: ReturnType<typeof setup>['call'], provider = 'google') {
  const response = await call(`/api/auth/${provider}`);
  const cookie = cookiesOf(response).get('nt_oauth');
  const state = new URL(response.headers.get('Location') ?? '').searchParams.get('state');
  return { response, cookie: `nt_oauth=${cookie?.value ?? ''}`, state: state ?? '' };
}

/** Signs in with the profile behind `code`; returns the `nt_session` cookie header. */
async function signIn(call: ReturnType<typeof setup>['call'], provider: string, code: string) {
  const { cookie, state } = await begin(call, provider);
  const response = await call(
    `/api/auth/${provider}/callback?${new URLSearchParams({ code, state })}`,
    { headers: { Cookie: cookie } },
  );
  const session = cookiesOf(response).get('nt_session');
  return { response, session: `nt_session=${session?.value ?? ''}` };
}

async function count(table: string): Promise<number> {
  const row = await env.DB.prepare(`SELECT count(*) AS n FROM ${table}`).first();
  return row === null ? -1 : Number(row['n']);
}

beforeEach(async () => {
  await env.DB.prepare('DELETE FROM users').run();
});

describe('GET /api/auth/:provider', () => {
  it('redirects to the provider with a state cookie that only the auth routes see', async () => {
    const { response, cookie, state } = await begin(setup().call);
    expect(response.status).toBe(302);
    const location = new URL(response.headers.get('Location') ?? '');
    expect(location.origin + location.pathname).toBe('https://idp.example/google');
    expect(location.searchParams.get('redirectUri')).toBe(
      'http://localhost:5173/api/auth/google/callback',
    );
    expect(state).not.toBe('');
    const set = cookiesOf(response).get('nt_oauth');
    expect(cookie).toContain(state);
    // Local development is plain http, so no `Secure`.
    expect(set?.attributes).toBe('Max-Age=600; Path=/api/auth; HttpOnly; SameSite=Lax');
  });

  it('marks the state cookie Secure on an https origin', async () => {
    const { call } = setup({ APP_ORIGIN: 'https://nekotype.pages.dev' });
    const response = await call('/api/auth/github');
    expect(cookiesOf(response).get('nt_oauth')?.attributes).toContain('Secure');
  });

  it('answers an unknown provider with 404', async () => {
    const response = await setup().call('/api/auth/facebook');
    expect(response.status).toBe(404);
    expect(await response.json()).toEqual({ error: { code: 'not_found' } });
  });

  it('answers 503 when the deployment has no secret for the provider', async () => {
    const response = await setup({ GOOGLE_CLIENT_SECRET: undefined }).call('/api/auth/google');
    expect(response.status).toBe(503);
    expect(await response.json()).toEqual({ error: { code: 'unavailable' } });
  });

  it('does not exist on a preview, callback and logout included (S3)', async () => {
    const { call } = setup({ ENVIRONMENT: 'preview', APP_ORIGIN: undefined });
    expect((await call('/api/auth/google')).status).toBe(404);
    expect((await call('/api/auth/google/callback?code=x&state=y')).status).toBe(404);
    const logout = await call('/api/auth/logout', {
      method: 'POST',
      headers: { Origin: 'http://localhost' },
    });
    expect(logout.status).toBe(404);
  });
});

describe('GET /api/auth/:provider/callback', () => {
  it('creates the user, its sign-in method and its user_stats row, and starts a session', async () => {
    const { call } = setup();
    const { response, session } = await signIn(call, 'google', 'google-alice');
    expect(response.status).toBe(302);
    expect(response.headers.get('Location')).toBe('/');

    const user = await env.DB.prepare('SELECT * FROM users').first();
    expect(user).toMatchObject({
      email: 'alice@example.com',
      display_name: 'Alice',
      avatar_url: 'https://img.example/alice.png',
      created_at: 1_700_000_000_000,
    });
    expect(await env.DB.prepare('SELECT * FROM oauth_accounts').first()).toMatchObject({
      provider: 'google',
      provider_user_id: 'g-1',
      user_id: user?.['id'],
    });
    expect(await env.DB.prepare('SELECT * FROM user_stats').first()).toMatchObject({
      user_id: user?.['id'],
      kana_stats: '{}',
      counters: '{"started":{"typing":0,"learn":0},"finished":{"typing":0,"learn":0}}',
      learn: '{"unlocked":{"hiragana":[],"katakana":[]},"entries":{},"stats":{},"activeDays":[]}',
      learn_recent: '{}',
      learn_buckets: '{"hiragana":{},"katakana":{}}',
      typing_records: '{}',
      device_seq: '{}',
      last_sync_at: 0,
      version: 0,
    });
    expect(session).not.toBe('nt_session=');
  });

  it('stores only the hash of the session token', async () => {
    const { call, clock } = setup();
    const { session } = await signIn(call, 'google', 'google-alice');
    const token = session.slice('nt_session='.length);
    const row = await env.DB.prepare('SELECT * FROM sessions').first();
    expect(row).toMatchObject({
      id_hash: await hashToken(token),
      expires_at: clock.time + 30 * DAY,
    });
    expect(JSON.stringify(row)).not.toContain(token);
  });

  it('sets the session cookie HttpOnly, Lax, for the whole site and for 30 days', async () => {
    const { response } = await signIn(setup().call, 'google', 'google-alice');
    const cookies = cookiesOf(response);
    expect(cookies.get('nt_session')?.attributes).toBe(
      `Max-Age=${30 * 24 * 60 * 60}; Path=/; HttpOnly; SameSite=Lax`,
    );
    // The state cookie is spent.
    expect(cookies.get('nt_oauth')?.value).toBe('');
  });

  it('signs the same person in again as the same user', async () => {
    const { call } = setup();
    await signIn(call, 'google', 'google-alice');
    await signIn(call, 'google', 'google-alice');
    expect(await count('users')).toBe(1);
    expect(await count('sessions')).toBe(2);
  });

  it('links a second provider with the same verified email to the same user (A4)', async () => {
    const { call } = setup();
    await signIn(call, 'google', 'google-alice');
    await signIn(call, 'github', 'github-alice');
    expect(await count('users')).toBe(1);
    expect(await count('user_stats')).toBe(1);
    const accounts = await env.DB.prepare(
      'SELECT provider FROM oauth_accounts ORDER BY provider',
    ).all();
    expect(accounts.results.map((row) => row['provider'])).toEqual(['github', 'google']);
  });

  it('creates a separate user for an unverified email and stores no address', async () => {
    const { call } = setup();
    await signIn(call, 'google', 'google-alice');
    await signIn(call, 'github', 'github-unverified');
    await signIn(call, 'github', 'github-unverified-2');
    expect(await count('users')).toBe(3);
    const unverified = await env.DB.prepare('SELECT email FROM users WHERE display_name LIKE ?')
      .bind('Bob%')
      .all();
    expect(unverified.results.map((row) => row['email'])).toEqual([null, null]);
  });

  it('removes the expired sessions of the user at sign-in', async () => {
    const { call, clock } = setup();
    await signIn(call, 'google', 'google-alice');
    clock.time += 31 * DAY;
    await signIn(call, 'google', 'google-alice');
    expect(await count('sessions')).toBe(1);
  });

  it('redirects to /?auth_error=denied when the user refused', async () => {
    const { call } = setup();
    const { cookie } = await begin(call);
    const response = await call('/api/auth/google/callback?error=access_denied', {
      headers: { Cookie: cookie },
    });
    expect(response.status).toBe(302);
    expect(response.headers.get('Location')).toBe('/?auth_error=denied');
    expect(await count('users')).toBe(0);
  });

  it.each([
    ['no state cookie', () => ''],
    ['another state', (cookie: string) => cookie.replace('nt_oauth=', 'nt_oauth=other')],
  ])('redirects to /?auth_error=failed with %s', async (_label, tamper) => {
    const { call } = setup();
    const { cookie, state } = await begin(call);
    const response = await call(
      `/api/auth/google/callback?${new URLSearchParams({ code: 'google-alice', state })}`,
      { headers: { Cookie: tamper(cookie) } },
    );
    expect(response.headers.get('Location')).toBe('/?auth_error=failed');
    expect(await count('users')).toBe(0);
    expect(await count('sessions')).toBe(0);
  });

  it('redirects to /?auth_error=failed with a missing or wrong state parameter', async () => {
    const { call } = setup();
    const { cookie } = await begin(call);
    const noState = await call('/api/auth/google/callback?code=google-alice', {
      headers: { Cookie: cookie },
    });
    expect(noState.headers.get('Location')).toBe('/?auth_error=failed');
    const wrong = await call('/api/auth/google/callback?code=google-alice&state=nope', {
      headers: { Cookie: cookie },
    });
    expect(wrong.headers.get('Location')).toBe('/?auth_error=failed');
  });

  it('redirects to /?auth_error=failed without a code or when the exchange fails', async () => {
    const { call } = setup();
    const first = await begin(call);
    const noCode = await call(`/api/auth/google/callback?state=${first.state}`, {
      headers: { Cookie: first.cookie },
    });
    expect(noCode.headers.get('Location')).toBe('/?auth_error=failed');
    const second = await begin(call);
    const bad = await call(`/api/auth/google/callback?code=rejected&state=${second.state}`, {
      headers: { Cookie: second.cookie },
    });
    expect(bad.headers.get('Location')).toBe('/?auth_error=failed');
    expect(await count('users')).toBe(0);
  });
});

describe('GET /api/me', () => {
  it('answers with the profile of the session', async () => {
    const { call } = setup();
    const { session } = await signIn(call, 'google', 'google-alice');
    const response = await call('/api/me', { headers: { Cookie: session } });
    expect(response.status).toBe(200);
    expect(await response.json()).toEqual({
      id: (await env.DB.prepare('SELECT id FROM users').first())?.['id'],
      email: 'alice@example.com',
      displayName: 'Alice',
      avatarUrl: 'https://img.example/alice.png',
    });
  });

  it('answers 401 without a session cookie, with an unknown one and with an expired one', async () => {
    const { call, clock } = setup();
    const expected = { error: { code: 'unauthenticated' } };
    const none = await call('/api/me');
    expect(none.status).toBe(401);
    expect(await none.json()).toEqual(expected);
    expect((await call('/api/me', { headers: { Cookie: 'nt_session=unknown' } })).status).toBe(401);

    const { session } = await signIn(call, 'google', 'google-alice');
    clock.time += 30 * DAY;
    const expired = await call('/api/me', { headers: { Cookie: session } });
    expect(expired.status).toBe(401);
    expect(await expired.json()).toEqual(expected);
    // The expired row is deleted when it is seen.
    expect(await count('sessions')).toBe(0);
  });

  it('renews a session with less than 15 days left, and not one with more', async () => {
    const { call, clock } = setup();
    const { session } = await signIn(call, 'google', 'google-alice');
    const signedInAt = clock.time;

    clock.time = signedInAt + 14 * DAY; // 16 days left
    const early = await call('/api/me', { headers: { Cookie: session } });
    expect(early.status).toBe(200);
    expect(cookiesOf(early).has('nt_session')).toBe(false);
    expect((await env.DB.prepare('SELECT expires_at FROM sessions').first())?.['expires_at']).toBe(
      signedInAt + 30 * DAY,
    );

    clock.time = signedInAt + 16 * DAY; // 14 days left
    const late = await call('/api/me', { headers: { Cookie: session } });
    expect(late.status).toBe(200);
    expect(cookiesOf(late).get('nt_session')?.attributes).toContain(`Max-Age=${30 * 24 * 60 * 60}`);
    expect((await env.DB.prepare('SELECT expires_at FROM sessions').first())?.['expires_at']).toBe(
      clock.time + 30 * DAY,
    );
  });
});

describe('POST /api/auth/logout', () => {
  it('deletes the session row and the cookie, and answers 204', async () => {
    const { call } = setup();
    const { session } = await signIn(call, 'google', 'google-alice');
    const response = await call('/api/auth/logout', {
      method: 'POST',
      headers: { ...origin, Cookie: session },
    });
    expect(response.status).toBe(204);
    expect(cookiesOf(response).get('nt_session')?.value).toBe('');
    expect(await count('sessions')).toBe(0);
    expect((await call('/api/me', { headers: { Cookie: session } })).status).toBe(401);
  });

  it('answers 204 also when there was no valid session', async () => {
    const { call } = setup();
    expect((await call('/api/auth/logout', { method: 'POST', headers: origin })).status).toBe(204);
    const unknown = await call('/api/auth/logout', {
      method: 'POST',
      headers: { ...origin, Cookie: 'nt_session=unknown' },
    });
    expect(unknown.status).toBe(204);
  });

  it('rejects a foreign Origin with 403 and keeps the session', async () => {
    const { call } = setup();
    const { session } = await signIn(call, 'google', 'google-alice');
    const response = await call('/api/auth/logout', {
      method: 'POST',
      headers: { Origin: 'https://evil.example', Cookie: session },
    });
    expect(response.status).toBe(403);
    expect(await count('sessions')).toBe(1);
  });
});
