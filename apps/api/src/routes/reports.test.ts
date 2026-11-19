import { env } from 'cloudflare:workers';
import { describe, expect, it } from 'vitest';
import { createApp } from '../app';
import { signedInUser } from '../test-support';
import { testDeps } from '../test-deps';

const START = 1_700_000_000_000;
const SECRET = 'a-real-looking-secret';
const TEST_SECRET = '1x0000000000000000000000000000000AA';
const origin = { Origin: 'http://localhost:5173' };

let counter = 0;
let ids = 0;

const report = (extra: Record<string, unknown> = {}) => ({
  itemId: 'w:hiragana:ねこ',
  contentVersion: 'c1',
  reason: 'wrong_reading',
  turnstileToken: 'pass',
  ...extra,
});

function setup(bindings: Record<string, unknown> = { TURNSTILE_SECRET_KEY: SECRET }) {
  const { deps } = testDeps({}, START);
  // Every app of a test starts its fake bytes from 1, and the database outlives the apps.
  const app = createApp({ ...deps, randomBytes: (n) => new Uint8Array(n).fill(++ids) });
  const post = (body: unknown, headers: Record<string, string> = {}) =>
    app.request(
      '/api/reports',
      {
        method: 'POST',
        headers: { ...origin, 'Content-Type': 'application/json', ...headers },
        body: typeof body === 'string' ? body : JSON.stringify(body),
      },
      { ...env, ...bindings },
    );
  return { post };
}

async function stored(itemId: string) {
  return env.DB.prepare(
    'SELECT user_id, item_id, content_version, reason, comment, created_at FROM content_reports WHERE item_id = ?',
  )
    .bind(itemId)
    .all();
}

describe('POST /api/reports', () => {
  it('stores an anonymous report', async () => {
    counter += 1;
    const itemId = `anon-${counter}`;
    const response = await setup().post(report({ itemId, comment: 'ねこ is read neko' }));
    expect(response.status).toBe(204);
    const { results } = await stored(itemId);
    expect(results).toEqual([
      {
        user_id: null,
        item_id: itemId,
        content_version: 'c1',
        reason: 'wrong_reading',
        comment: 'ねこ is read neko',
        created_at: START,
      },
    ]);
  });

  it('sets user_id for a valid session, and stays anonymous for a bad one', async () => {
    counter += 1;
    const { cookie } = await signedInUser(env.DB, `reporter-${counter}`, START);
    const mine = `signed-${counter}`;
    const { post } = setup();
    expect((await post(report({ itemId: mine }), { Cookie: cookie })).status).toBe(204);
    expect((await stored(mine)).results[0]?.['user_id']).toBe(`reporter-${counter}`);

    const stale = `stale-${counter}`;
    expect(
      (await post(report({ itemId: stale }), { Cookie: 'nt_session=not-a-session' })).status,
    ).toBe(204);
    expect((await stored(stale)).results[0]?.['user_id']).toBeNull();
  });

  it('answers 403 turnstile_failed for a rejected token and stores nothing', async () => {
    counter += 1;
    const itemId = `rejected-${counter}`;
    const response = await setup().post(report({ itemId, turnstileToken: 'fail' }));
    expect(response.status).toBe(403);
    expect(await response.json()).toEqual({ error: { code: 'turnstile_failed' } });
    expect((await stored(itemId)).results).toHaveLength(0);
  });

  it('answers 503 when Cloudflare cannot be asked', async () => {
    const response = await setup().post(report({ turnstileToken: 'down' }));
    expect(response.status).toBe(503);
    expect(await response.json()).toEqual({ error: { code: 'unavailable' } });
  });

  it('answers 413 over 8 KB', async () => {
    const response = await setup().post(report({ comment: 'x'.repeat(9000) }));
    expect(response.status).toBe(413);
    expect(await response.json()).toEqual({ error: { code: 'too_large' } });
  });

  it('answers 400 for a long comment, an unknown reason, extra fields and bad JSON', async () => {
    const { post } = setup();
    for (const body of [
      report({ comment: 'x'.repeat(501) }),
      report({ reason: 'reading' }),
      report({ extra: 1 }),
      report({ turnstileToken: '' }),
      '{not json',
    ]) {
      const response = await post(body);
      expect(response.status).toBe(400);
      expect(await response.json()).toEqual({ error: { code: 'invalid_body' } });
    }
  });

  it('accepts a comment of exactly 500 characters', async () => {
    counter += 1;
    const itemId = `limit-${counter}`;
    expect((await setup().post(report({ itemId, comment: 'x'.repeat(500) }))).status).toBe(204);
  });

  it('is closed without the secret', async () => {
    for (const bindings of [{}, { TURNSTILE_SECRET_KEY: '' }]) {
      const response = await setup(bindings).post(report());
      expect(response.status).toBe(503);
      expect(await response.json()).toEqual({ error: { code: 'unavailable' } });
    }
  });

  it("refuses Cloudflare's test secret in production, accepts it elsewhere", async () => {
    const production = await setup({
      TURNSTILE_SECRET_KEY: TEST_SECRET,
      ENVIRONMENT: 'production',
    }).post(report());
    expect(production.status).toBe(503);
    counter += 1;
    const itemId = `test-secret-${counter}`;
    const preview = await setup({
      TURNSTILE_SECRET_KEY: TEST_SECRET,
      ENVIRONMENT: 'preview',
    }).post(report({ itemId }));
    expect(preview.status).toBe(204);
  });

  it('refuses a foreign Origin', async () => {
    const response = await setup().post(report(), { Origin: 'https://evil.example' });
    expect(response.status).toBe(403);
  });
});
