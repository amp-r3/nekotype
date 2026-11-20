import { env } from 'cloudflare:workers';
import { isSettings } from '@nekotype/shared/runtime';
import { describe, expect, it } from 'vitest';

// Migration 0002 rewrites the rows of P5 (p6-plan.md, D9). The setup has applied every migration to
// an empty database, so the test writes rows with the shapes P5 stored and runs the statements of
// 0002 on them.

const NAME = '0002_learning_only.sql';
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

async function migrate(): Promise<void> {
  const migration = env.TEST_MIGRATIONS.find((m) => m.name === NAME);
  if (migration === undefined) throw new Error(`${NAME} is not among the migrations`);
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
    await p5User('m-synced', P5_COUNTERS, true);
    await p5User('m-new', P5_NEW_USER_COUNTERS, false);

    await migrate();

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
