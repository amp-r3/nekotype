// Writes the year-long `user_stats` row of ADR 078 to the remote D1 `nekotype-bench`, and resets it.
// D1 allows 100 KB per statement, so each large column is appended in chunks.
import { execFileSync } from 'node:child_process';
import { mkdtempSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { KANA_KEYS, generateYear } from '@nekotype/shared/testing';

const USER_ID = 'bench-user';
const CHUNK_CHARS = 20_000; // up to 60 KB of UTF-8 for kana

const SCHEMA = `
DROP TABLE IF EXISTS user_stats;
DROP TABLE IF EXISTS user_settings;
DROP TABLE IF EXISTS results;
CREATE TABLE user_stats (
  user_id TEXT PRIMARY KEY,
  kana_stats TEXT NOT NULL, counters TEXT NOT NULL,
  learn TEXT NOT NULL, learn_recent TEXT NOT NULL, learn_buckets TEXT NOT NULL,
  typing_records TEXT NOT NULL, device_seq TEXT NOT NULL, last_sync_at INTEGER NOT NULL,
  version INTEGER NOT NULL DEFAULT 0
);
CREATE TABLE user_settings (user_id TEXT PRIMARY KEY, json TEXT NOT NULL, updated_at INTEGER NOT NULL);
CREATE TABLE results (
  id TEXT PRIMARY KEY, user_id TEXT NOT NULL,
  ended_at INTEGER NOT NULL, content TEXT NOT NULL, script TEXT NOT NULL, strictness TEXT NOT NULL,
  config TEXT NOT NULL, kpm REAL NOT NULL, kana_accuracy REAL NOT NULL, json TEXT NOT NULL
);
CREATE INDEX results_user_time ON results(user_id, ended_at DESC);
`;

const quote = (text: string): string => `'${text.replaceAll("'", "''")}'`;

export function seedSql(seed = 1): { sql: string; sizes: Record<string, number> } {
  const year = generateYear({ seed, keys: KANA_KEYS });
  const { recent, recallBuckets, ...rest } = year.learn;
  const columns: [string, string][] = [
    ['kana_stats', JSON.stringify(year.kanaStats)],
    ['counters', JSON.stringify(year.counters)],
    ['learn', JSON.stringify(rest)],
    ['learn_recent', JSON.stringify(recent)],
    ['learn_buckets', JSON.stringify(recallBuckets)],
    ['typing_records', JSON.stringify(year.typingRecords)],
    ['device_seq', JSON.stringify(year.deviceSeq)],
  ];
  const lines = [
    SCHEMA,
    `INSERT INTO user_stats (user_id, kana_stats, counters, learn, learn_recent, learn_buckets, typing_records, device_seq, last_sync_at, version) VALUES (${quote(USER_ID)}, '', '', '', '', '', '', '', 0, 0);`,
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
