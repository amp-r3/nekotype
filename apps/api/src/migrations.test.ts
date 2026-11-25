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

const FORMAT_2_COLUMNS = ['counters', 'learn', 'learn_recent', 'learn_buckets', 'bucket_newest'];

async function userStatsColumns(): Promise<string[]> {
  const { results } = await env.DB.prepare(
    "SELECT name FROM pragma_table_info('user_stats') ORDER BY cid",
  ).all<{ name: string }>();
  return results.map((column) => column.name);
}

// The columns of sync format 2, which 0005 dropped.
async function restoreFormat2Columns(): Promise<void> {
  const columns = await userStatsColumns();
  const missing = FORMAT_2_COLUMNS.filter((name) => !columns.includes(name));
  if (missing.length === 0) return;
  await env.DB.batch(
    missing.map((name) =>
      env.DB.prepare(`ALTER TABLE user_stats ADD COLUMN ${name} TEXT NOT NULL DEFAULT '{}'`),
    ),
  );
}

async function restoreP5Schema(): Promise<void> {
  await restoreFormat2Columns();
  if ((await userStatsColumns()).includes('kana_stats')) return;
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

describe('migration 0006 (drop the target answer time)', () => {
  it('removes learn.targetMs and leaves a valid document', async () => {
    await env.DB.batch([
      env.DB.prepare('INSERT INTO users (id, created_at) VALUES (?, 1)').bind('m-target'),
      env.DB.prepare('INSERT INTO user_settings (user_id, json, updated_at) VALUES (?, ?, 7)').bind(
        'm-target',
        JSON.stringify({ learn: P5_SETTINGS.learn, updatedAt: 7 }),
      ),
    ]);

    await migrate('0006_drop_target_answer_time.sql');

    const settings: unknown = JSON.parse(
      await text('SELECT json FROM user_settings WHERE user_id = ?', 'm-target'),
    );
    expect(settings).toEqual({
      learn: { strictness: 'learner', track: 'hiragana', sound: true },
      updatedAt: 7,
    });
    expect(isSettings(settings)).toBe(true);
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

// Migration 0004 is additive (P7 plan, D13): the table of the batches of sync format 3.
describe('migration 0004 (sync_batches)', () => {
  it('creates a table whose primary key is the table', async () => {
    const columns = await env.DB.prepare(
      "SELECT name, pk FROM pragma_table_info('sync_batches') ORDER BY cid",
    ).all<{ name: string; pk: number }>();
    expect(columns.results.map((column) => column.name)).toEqual([
      'user_id',
      'id',
      'device_id',
      'seq',
      'log',
      'created_at',
    ]);
    expect(columns.results.filter((column) => column.pk > 0).map((column) => column.name)).toEqual([
      'user_id',
      'id',
    ]);
    const table = await env.DB.prepare(
      "SELECT sql FROM sqlite_master WHERE name = 'sync_batches'",
    ).first<{ sql: string }>();
    expect(table?.sql).toMatch(/WITHOUT ROWID/);
  });
});

// Migration 0005 drops the columns of sync format 2 (P7 plan, D13). The setup has applied it, so the
// test puts the columns back, writes a row with what format 2 stored and runs the migration again.
describe('migration 0005 (drop learning columns)', () => {
  it('leaves user_id, device_seq, last_sync_at and version, with their data and the cascade', async () => {
    await restoreFormat2Columns();
    await env.DB.batch([
      env.DB.prepare('INSERT INTO users (id, created_at) VALUES (?, 1)').bind('s-user'),
      env.DB.prepare(
        `INSERT INTO user_stats (user_id, counters, learn, learn_recent, learn_buckets, bucket_newest,
           device_seq, last_sync_at, version)
         VALUES (?, '{"started":1,"finished":1}', '{}', '{}', '{}', '{}', '{"d":{"seq":2,"at":5}}', 9, 3)`,
      ).bind('s-user'),
    ]);

    await migrate('0005_drop_learning_columns.sql');

    expect(await userStatsColumns()).toEqual(['user_id', 'device_seq', 'last_sync_at', 'version']);
    expect(
      await env.DB.prepare('SELECT * FROM user_stats WHERE user_id = ?').bind('s-user').first(),
    ).toEqual({
      user_id: 's-user',
      device_seq: '{"d":{"seq":2,"at":5}}',
      last_sync_at: 9,
      version: 3,
    });

    await env.DB.prepare('DELETE FROM users WHERE id = ?').bind('s-user').run();
    const left = await env.DB.prepare('SELECT COUNT(*) AS n FROM user_stats WHERE user_id = ?')
      .bind('s-user')
      .first();
    expect(left).toEqual({ n: 0 });
  });
});
