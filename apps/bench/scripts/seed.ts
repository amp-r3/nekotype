// Resets the remote D1 `nekotype-bench` to the application's schema and writes a user, a session,
// settings and a year of log: `syntheticLog({ answers: 40_000, seed: 1 })` of another device cut into
// SEED_PAGES rows of `sync_batches` (p7-plan.md, D24). The Pages project of the bench serves the
// real application, so the requests of `measure.ts` are signed in like a user's.
import { execFileSync } from 'node:child_process';
import { createHash } from 'node:crypto';
import { mkdtempSync, readdirSync, readFileSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { syntheticLog } from '@nekotype/model/testing';
import { encodePage } from '@nekotype/shared/runtime';
import type { ValidSettings } from '@nekotype/shared/types';

const USER_ID = 'bench-user';
/** The session token `measure.ts` sends; D1 keeps its SHA-256 digest only. */
export const SESSION_TOKEN = 'bench-session-token';
/** Rows of `sync_batches` the seed writes; the seeded device is the author of all of them. */
export const SEED_PAGES = 700;
const SEED_ANSWERS = 40_000;
const SEED_DEVICE = '5eed5eed-5eed-4eed-8eed-5eed5eed5eed';
/** The device `measure.ts` sends as: it has no `device_seq` entry, so its first `seq` is 1. */
export const BENCH_DEVICE = 'be9c0be9-0be9-4be9-8be9-0be90be90be9';
const migrations = fileURLToPath(new URL('../../api/migrations', import.meta.url));

/** Drops the tables of the application and creates them again with its own migrations. */
function schema(): string {
  const drops = [
    'sync_batches',
    'content_reports',
    'user_settings',
    'user_stats',
    'sessions',
    'oauth_accounts',
    'users',
  ].map((table) => `DROP TABLE IF EXISTS ${table};`);
  const files = readdirSync(migrations)
    .filter((name) => name.endsWith('.sql'))
    .sort();
  return [...drops, ...files.map((name) => readFileSync(join(migrations, name), 'utf8'))].join(
    '\n',
  );
}

/** Settings of the bench user; a finished session of `measure.ts` sends them newer, as a device would. */
export function benchSettings(updatedAt: number): ValidSettings {
  return {
    learn: { strictness: 'learner', track: 'hiragana', sound: true },
    updatedAt,
  };
}

const quote = (text: string): string => `'${text.replaceAll("'", "''")}'`;

export function seedSql(seed = 1): { sql: string; events: number; bytes: number } {
  const events = syntheticLog({ answers: SEED_ANSWERS, seed }).map((event) => ({
    ...event,
    dev: SEED_DEVICE,
  }));
  const sessionHash = createHash('sha256').update(SESSION_TOKEN).digest('hex');
  const rows: string[] = [];
  let bytes = 0;
  for (let id = 1; id <= SEED_PAGES; id += 1) {
    const page = events.slice(
      Math.floor(((id - 1) * events.length) / SEED_PAGES),
      Math.floor((id * events.length) / SEED_PAGES),
    );
    if (page.length === 0) throw new Error('the seed has fewer events than pages');
    const log = JSON.stringify(encodePage(page));
    bytes += log.length;
    rows.push(
      `INSERT INTO sync_batches (user_id, id, device_id, seq, log, created_at) VALUES (${quote(USER_ID)}, ${id}, ${quote(SEED_DEVICE)}, ${id}, ${quote(log)}, ${id});`,
    );
  }
  const deviceSeq = JSON.stringify({ [SEED_DEVICE]: { seq: SEED_PAGES, at: 0 } });
  const lines = [
    schema(),
    `INSERT INTO users (id, email, display_name, avatar_url, created_at) VALUES (${quote(USER_ID)}, NULL, NULL, NULL, 0);`,
    `INSERT INTO sessions (id_hash, user_id, expires_at) VALUES (${quote(sessionHash)}, ${quote(USER_ID)}, 4102444800000);`,
    // The settings row exists, as for any user who has synced once: a change updates it in place.
    `INSERT INTO user_settings (user_id, json, updated_at) VALUES (${quote(USER_ID)}, ${quote(JSON.stringify(benchSettings(0)))}, 0);`,
    `INSERT INTO user_stats (user_id, device_seq, last_sync_at, version) VALUES (${quote(USER_ID)}, ${quote(deviceSeq)}, 0, 0);`,
    ...rows,
  ];
  return { sql: lines.join('\n'), events: events.length, bytes };
}

export function seed(): void {
  const { sql, events, bytes } = seedSql();
  const dir = mkdtempSync(join(tmpdir(), 'nekotype-bench-'));
  const file = join(dir, 'seed.sql');
  writeFileSync(file, sql);
  console.log(`seed: ${events} events in ${SEED_PAGES} rows, ${bytes} bytes of log`);
  const root = fileURLToPath(new URL('..', import.meta.url));
  execFileSync(
    'pnpm',
    ['exec', 'wrangler', 'd1', 'execute', 'nekotype-bench', '--remote', '--file', file],
    { cwd: root, stdio: 'inherit' },
  );
}

if (process.argv[1] === fileURLToPath(import.meta.url)) seed();
