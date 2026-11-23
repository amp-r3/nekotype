import { env } from 'cloudflare:workers';
import { describe, expect, it } from 'vitest';
import { createApp } from './app';
import { testDeps } from './test-deps';

const app = createApp(testDeps().deps);
const call = (path: string, init?: RequestInit) => app.request(path, init, env);
const origin = { Origin: 'http://localhost:5173' };

describe('the migrations', () => {
  it('create every table of the spec and its indexes', async () => {
    const { results } = await env.DB.prepare(
      "SELECT name FROM sqlite_master WHERE type IN ('table', 'index') AND name NOT LIKE 'sqlite_%' AND name NOT LIKE '_cf_%' AND name NOT LIKE 'd1_%'",
    ).all<{ name: string }>();
    const names = results.map((row) => row.name);
    for (const expected of [
      'users',
      'users_email',
      'oauth_accounts',
      'sessions',
      'user_settings',
      'user_stats',
      'content_reports',
    ]) {
      expect(names).toContain(expected);
    }
  });

  it('hold no typing data (0003)', async () => {
    const { results } = await env.DB.prepare('SELECT name FROM pragma_table_info(?)')
      .bind('user_stats')
      .all<{ name: string }>();
    const columns = results.map((row) => row.name);
    expect(columns).not.toContain('kana_stats');
    expect(columns).not.toContain('typing_records');
    expect(columns).toContain('device_seq');
    const tables = await env.DB.prepare(
      "SELECT name FROM sqlite_master WHERE name IN ('results', 'results_user_time')",
    ).all();
    expect(tables.results).toEqual([]);
  });
});

describe('the application', () => {
  it('has no route for the typing history', async () => {
    const response = await call('/api/results', { headers: { Cookie: 'nt_session=x' } });
    expect(response.status).toBe(404);
    expect(await response.json()).toEqual({ error: { code: 'not_found' } });
  });

  it('answers an unknown path with 404 and the error body', async () => {
    const response = await call('/api/unknown');
    expect(response.status).toBe(404);
    expect(await response.json()).toEqual({ error: { code: 'not_found' } });
  });

  it('rejects a POST without an Origin header', async () => {
    const response = await call('/api/unknown', { method: 'POST' });
    expect(response.status).toBe(403);
    expect(await response.json()).toEqual({ error: { code: 'bad_origin' } });
  });

  it('rejects a DELETE from a foreign origin', async () => {
    const response = await call('/api/unknown', {
      method: 'DELETE',
      headers: { Origin: 'https://evil.example' },
    });
    expect(response.status).toBe(403);
  });

  it('lets a POST from the application origin through to the router', async () => {
    const response = await call('/api/unknown', { method: 'POST', headers: origin });
    expect(response.status).toBe(404);
  });

  it('takes the request origin when APP_ORIGIN is unset, as on a preview', async () => {
    const preview = { ...env, APP_ORIGIN: undefined };
    const url = 'https://pr-1.nekotype.pages.dev/api/unknown';
    const ok = await app.request(
      url,
      { method: 'POST', headers: { Origin: 'https://pr-1.nekotype.pages.dev' } },
      preview,
    );
    expect(ok.status).toBe(404);
    const bad = await app.request(
      url,
      { method: 'POST', headers: { Origin: 'https://nekotype.pages.dev' } },
      preview,
    );
    expect(bad.status).toBe(403);
  });

  it('answers a body over the limit with 413', async () => {
    const response = await call('/api/unknown', {
      method: 'POST',
      headers: { ...origin, 'Content-Type': 'application/json' },
      body: 'x'.repeat(256 * 1024 + 1),
    });
    expect(response.status).toBe(413);
    expect(await response.json()).toEqual({ error: { code: 'too_large' } });
  });
});
