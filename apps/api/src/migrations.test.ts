import { env } from 'cloudflare:workers';
import { isSettings } from '@nekotype/shared/runtime';
import { describe, expect, it } from 'vitest';

// Migration 0002 rewrites the rows of P5 and 0003 drops the typing table and columns (p6-plan.md,
// D9). The setup has applied every migration to an empty database, so each test first puts back the
// schema of P5 (the columns and the table 0003 dropped), writes rows with the shapes P5 stored and
// runs the statements of the migration under test on them.

const P5_SETTINGS = {
  typing: {
    script: 'both',
    content: 'words',
    strictness: 'learner',
    weakFocus: true,
    test: { kind: 'time', seconds: 30 },
    showTranslation: true,
  },
  learn: { strictness: 'learner', track: 'hiragana', targetMs: 1500, sound: true },
  updatedAt: 7,
};
const P5_COUNTERS = { started: { typing: 4, learn: 9 }, finished: { typing: 3, learn: 8 } };
// What `createUser` of P5 wrote: both modes, all zero.
const P5_NEW_USER_COUNTERS = {
  started: { typing: 0, learn: 0 },
  finished: { typing: 0, learn: 0 },
};

async function restoreP5Schema(): Promise<void> {
  const { results } = await env.DB.prepare("SELECT name FROM pragma_table_info('user_stats')").all<{
    name: string;
  }>();
  if (results.some((column) => column.name === 'kana_stats')) return;
  await env.DB.batch([
    env.DB.prepare("ALTER TABLE user_stats ADD COLUMN kana_stats TEXT NOT NULL DEFAULT '{}'"),
    env.DB.prepare("ALTER TABLE user_stats ADD COLUMN typing_records TEXT NOT NULL DEFAULT '{}'"),
    env.DB.prepare(
      `CREATE TABLE results (
         id TEXT PRIMARY KEY, user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
         ended_at INTEGER NOT NULL, content TEXT NOT NULL, script TEXT NOT NULL,
         strictness TEXT NOT NULL, config TEXT NOT NULL, kpm REAL NOT NULL,
         kana_accuracy REAL NOT NULL, json TEXT NOT NULL
       )`,
    ),
    env.DB.prepare('CREATE INDEX results_user_time ON results(user_id, ended_at DESC)'),
  ]);
}

async function p5User(id: string, counters: unknown, withSettings: boolean): Promise<void> {
  const statements = [
    env.DB.prepare('INSERT INTO users (id, created_at) VALUES (?, 1)').bind(id),
    env.DB.prepare(
      `INSERT INTO user_stats (user_id, kana_stats, counters, learn, learn_recent, learn_buckets,
         bucket_newest, typing_records, device_seq, last_sync_at)
       VALUES (?, '{"hiragana:あ":{"attempts":3,"erroredAttempts":1}}', ?, '{}', '{}', '{}', '{}',
         '{"words|hiragana|learner|time:60":{"best":null,"recent":[]}}', '{}', 0)`,
    ).bind(id, JSON.stringify(counters)),
    env.DB.prepare(
      `INSERT INTO results (id, user_id, ended_at, content, script, strictness, config, kpm, kana_accuracy, json)
       VALUES (?, ?, 1, 'words', 'hiragana', 'learner', 'time:60', 80, 0.95, '{}')`,
    ).bind(`${id}-result`, id),
  ];
  if (withSettings) {
    statements.push(
      env.DB.prepare('INSERT INTO user_settings (user_id, json, updated_at) VALUES (?, ?, 7)').bind(
        id,
        JSON.stringify(P5_SETTINGS),
      ),
    );
  }
  await env.DB.batch(statements);
}

async function migrate(name: string): Promise<void> {
  const migration = env.TEST_MIGRATIONS.find((m) => m.name === name);
  if (migration === undefined) throw new Error(`${name} is not among the migrations`);
  await env.DB.batch(migration.queries.map((query) => env.DB.prepare(query)));
}

async function text(sql: string, id: string): Promise<string> {
  const row = await env.DB.prepare(sql).bind(id).first();
  const value = row === null ? null : Object.values(row)[0];
  if (typeof value !== 'string') throw new Error(`no text for ${sql}`);
  return value;
}

describe('migration 0002', () => {
  it('flattens the counters, drops the typing block and empties the typing data', async () => {
    await restoreP5Schema();
    await p5User('m-synced', P5_COUNTERS, true);
    await p5User('m-new', P5_NEW_USER_COUNTERS, false);

    await migrate('0002_learning_only.sql');

    const counters = (id: string) => text('SELECT counters FROM user_stats WHERE user_id = ?', id);
    expect(JSON.parse(await counters('m-synced'))).toEqual({ started: 9, finished: 8 });
    // A user who never synced has both keys, so the rewrite gives 0 and not NULL.
    expect(JSON.parse(await counters('m-new'))).toEqual({ started: 0, finished: 0 });

    const settings: unknown = JSON.parse(
      await text('SELECT json FROM user_settings WHERE user_id = ?', 'm-synced'),
    );
    expect(settings).toEqual({ learn: P5_SETTINGS.learn, updatedAt: 7 });
    expect(isSettings(settings)).toBe(true);

    for (const id of ['m-synced', 'm-new']) {
      expect(await text('SELECT kana_stats FROM user_stats WHERE user_id = ?', id)).toBe('{}');
      expect(await text('SELECT typing_records FROM user_stats WHERE user_id = ?', id)).toBe('{}');
    }
    const left = await env.DB.prepare(
      "SELECT COUNT(*) AS n FROM results WHERE user_id LIKE 'm-%'",
    ).first();
    expect(left).toEqual({ n: 0 });
  });
});

describe('migration 0003', () => {
  it('drops the typing table and columns and keeps the learning data', async () => {
    await restoreP5Schema();
    await p5User('d-user', P5_COUNTERS, true);
    await migrate('0002_learning_only.sql');

    await migrate('0003_drop_typing.sql');

    const { results } = await env.DB.prepare(
      "SELECT name FROM pragma_table_info('user_stats')",
    ).all<{
      name: string;
    }>();
    const columns = results.map((column) => column.name);
    expect(columns).not.toContain('kana_stats');
    expect(columns).not.toContain('typing_records');
    expect(
      JSON.parse(await text('SELECT counters FROM user_stats WHERE user_id = ?', 'd-user')),
    ).toEqual({ started: 9, finished: 8 });
    const table = await env.DB.prepare(
      "SELECT name FROM sqlite_master WHERE name LIKE 'results%'",
    ).all();
    expect(table.results).toEqual([]);

    // The foreign key of user_stats still cascades.
    await env.DB.prepare('DELETE FROM users WHERE id = ?').bind('d-user').run();
    const left = await env.DB.prepare('SELECT COUNT(*) AS n FROM user_stats WHERE user_id = ?')
      .bind('d-user')
      .first();
    expect(left).toEqual({ n: 0 });
  });
});
