import { env } from 'cloudflare:workers';
import { describe, expect, it } from 'vitest';
import { hashToken } from '../auth/session';
import { createApp } from '../app';
import { signedInUser } from '../test-support';
import { testDeps } from '../test-deps';

const START = 1_700_000_000_000;
const origin = { Origin: 'http://localhost:5173' };
const TABLES = ['oauth_accounts', 'sessions', 'user_settings', 'user_stats'] as const;

let users = 0;

async function count(table: string, userId: string): Promise<number> {
  const row = await env.DB.prepare(`SELECT COUNT(*) AS n FROM ${table} WHERE user_id = ?`)
    .bind(userId)
    .first();
  return typeof row?.['n'] === 'number' ? row['n'] : -1;
}

/** A user with a second session, settings and a report. */
async function populated() {
  users += 1;
  const userId = `delete-user-${users}`;
  const { cookie } = await signedInUser(env.DB, userId, START);
  await env.DB.batch([
    env.DB.prepare('INSERT INTO sessions (id_hash, user_id, expires_at) VALUES (?, ?, ?)').bind(
      await hashToken(`other-${userId}`),
      userId,
      START + 1000,
    ),
    env.DB.prepare('INSERT INTO user_settings (user_id, json, updated_at) VALUES (?, ?, ?)').bind(
      userId,
      '{}',
      START,
    ),
    env.DB.prepare(
      `INSERT INTO content_reports (id, user_id, item_id, content_version, reason, comment, created_at)
       VALUES (?, ?, 'w1', 'c1', 'reading', 'wrong', ?)`,
    ).bind(`${userId}-report`, userId, START),
  ]);
  const { deps } = testDeps({}, START);
  const app = createApp(deps);
  const remove = (headers: Record<string, string>) =>
    app.request('/api/me', { method: 'DELETE', headers }, env);
  return { userId, cookie, remove };
}

describe('DELETE /api/me', () => {
  it('deletes the account with every table of it, keeps the report without a user, clears the cookie', async () => {
    const mine = await populated();
    const other = await populated();
    for (const table of TABLES) expect(await count(table, mine.userId)).toBeGreaterThan(0);

    const response = await mine.remove({ Cookie: mine.cookie, ...origin });

    expect(response.status).toBe(204);
    expect(response.headers.get('set-cookie')).toMatch(/nt_session=;/);
    for (const table of TABLES) expect(await count(table, mine.userId)).toBe(0);
    const user = await env.DB.prepare('SELECT id FROM users WHERE id = ?')
      .bind(mine.userId)
      .first();
    expect(user).toBeNull();
    const report = await env.DB.prepare('SELECT user_id, item_id FROM content_reports WHERE id = ?')
      .bind(`${mine.userId}-report`)
      .first();
    expect(report).toEqual({ user_id: null, item_id: 'w1' });
    // The session is gone: the same cookie is unauthenticated now.
    expect((await mine.remove({ Cookie: mine.cookie, ...origin })).status).toBe(401);

    // Another user is untouched.
    for (const table of TABLES) expect(await count(table, other.userId)).toBeGreaterThan(0);
    const kept = await env.DB.prepare('SELECT user_id FROM content_reports WHERE id = ?')
      .bind(`${other.userId}-report`)
      .first();
    expect(kept).toEqual({ user_id: other.userId });
  });

  it('answers 401 without a session and 403 without the right Origin', async () => {
    const mine = await populated();
    const anonymous = await mine.remove({ ...origin });
    expect(anonymous.status).toBe(401);
    expect(await anonymous.json()).toEqual({ error: { code: 'unauthenticated' } });

    const foreign = await mine.remove({ Cookie: mine.cookie, Origin: 'https://evil.example' });
    expect(foreign.status).toBe(403);
    expect(await count('user_settings', mine.userId)).toBe(1);
  });
});
