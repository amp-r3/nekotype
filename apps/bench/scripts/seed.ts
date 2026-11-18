// Resets the remote D1 `nekotype-bench` to the application's schema and writes a user, a session and
// the year-long `user_stats` row of ADR 078. The Pages project of the bench serves the real
// application, so the requests of `measure.ts` are signed in like a user's.
// D1 allows 100 KB per statement, so each large column is appended in chunks.
import { execFileSync } from 'node:child_process';
import { createHash } from 'node:crypto';
import { mkdtempSync, readdirSync, readFileSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { KANA_KEYS, generateYear } from '@nekotype/shared/testing';
import type { Year } from '@nekotype/shared/testing';

const USER_ID = 'bench-user';
/** The session token `measure.ts` sends; D1 keeps its SHA-256 digest only. */
export const SESSION_TOKEN = 'bench-session-token';
const CHUNK_CHARS = 20_000; // up to 60 KB of UTF-8 for kana
const migrations = fileURLToPath(new URL('../../api/migrations', import.meta.url));

/** Drops the tables of the application and creates them again with its own migrations. */
function schema(): string {
  const drops = [
    'content_reports',
    'results',
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

const quote = (text: string): string => `'${text.replaceAll("'", "''")}'`;

function newestDays(learn: Year['learn']): Record<string, number> {
  const newest: Record<string, number> = {};
  for (const track of ['hiragana', 'katakana'] as const) {
    newest[track] = Math.max(...Object.keys(learn.recallBuckets[track]).map(Number));
  }
  return newest;
}

export function seedSql(seed = 1): { sql: string; sizes: Record<string, number> } {
  const year = generateYear({ seed, keys: KANA_KEYS });
  const { recent, recallBuckets, ...rest } = year.learn;
  const columns: [string, string][] = [
    ['kana_stats', JSON.stringify(year.kanaStats)],
    ['counters', JSON.stringify(year.counters)],
    ['learn', JSON.stringify(rest)],
    ['learn_recent', JSON.stringify(recent)],
    ['learn_buckets', JSON.stringify(recallBuckets)],
    ['bucket_newest', JSON.stringify(newestDays(year.learn))],
    ['typing_records', JSON.stringify(year.typingRecords)],
    ['device_seq', JSON.stringify(year.deviceSeq)],
  ];
  const sessionHash = createHash('sha256').update(SESSION_TOKEN).digest('hex');
  const lines = [
    schema(),
    `INSERT INTO users (id, email, display_name, avatar_url, created_at) VALUES (${quote(USER_ID)}, NULL, NULL, NULL, 0);`,
    `INSERT INTO sessions (id_hash, user_id, expires_at) VALUES (${quote(sessionHash)}, ${quote(USER_ID)}, 4102444800000);`,
    `INSERT INTO user_stats (user_id, kana_stats, counters, learn, learn_recent, learn_buckets, bucket_newest, typing_records, device_seq, last_sync_at, version) VALUES (${quote(USER_ID)}, '', '', '', '', '', '', '', '', 0, 0);`,
  ];
  const sizes: Record<string, number> = {};
  for (const [column, text] of columns) {
    sizes[column] = new TextEncoder().encode(text).length;
    for (let at = 0; at < text.length; at += CHUNK_CHARS) {
      const chunk = text.slice(at, at + CHUNK_CHARS);
      lines.push(
        `UPDATE user_stats SET ${column} = ${column} || ${quote(chunk)} WHERE user_id = ${quote(USER_ID)};`,
      );
    }
  }
  return { sql: lines.join('\n'), sizes };
}

export function seed(): void {
  const { sql, sizes } = seedSql();
  const dir = mkdtempSync(join(tmpdir(), 'nekotype-bench-'));
  const file = join(dir, 'seed.sql');
  writeFileSync(file, sql);
  console.log('column sizes (bytes):', sizes);
  const root = fileURLToPath(new URL('..', import.meta.url));
  execFileSync(
    'pnpm',
    ['exec', 'wrangler', 'd1', 'execute', 'nekotype-bench', '--remote', '--file', file],
    { cwd: root, stdio: 'inherit' },
  );
}

if (process.argv[1] === fileURLToPath(import.meta.url)) seed();
