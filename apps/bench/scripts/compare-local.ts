// Applies each batch to a local D1 through `base` and through `keyed` and compares the stored rows.
// Usage: start `pnpm exec wrangler pages dev public --port 8799` in apps/bench, then run this file.
import { execFileSync } from 'node:child_process';
import { mkdtempSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { isDeepStrictEqual } from 'node:util';
import { KANA_KEYS, generateBatch } from '@nekotype/shared/testing';
import { seedSql } from './seed';

const root = fileURLToPath(new URL('..', import.meta.url));
const COLUMNS = [
  'kana_stats',
  'counters',
  'learn',
  'learn_recent',
  'learn_buckets',
  'typing_records',
  'version',
];

function d1(args: string[]): string {
  return execFileSync(
    'pnpm',
    ['exec', 'wrangler', 'd1', 'execute', 'nekotype-bench', '--local', ...args],
    {
      cwd: root,
      encoding: 'utf8',
      maxBuffer: 64 * 1024 * 1024,
    },
  );
}

function seedLocal(): void {
  const file = join(mkdtempSync(join(tmpdir(), 'nekotype-bench-')), 'seed.sql');
  writeFileSync(file, seedSql().sql);
  d1(['--file', file]);
}

function row(): Record<string, unknown> {
  const out: unknown = JSON.parse(
    d1([
      '--json',
      '--command',
      `SELECT ${COLUMNS.join(', ')}, (SELECT count(*) FROM results) AS results FROM user_stats`,
    ]),
  );
  const first: unknown = Array.isArray(out) ? out[0]?.results?.[0] : undefined;
  if (typeof first !== 'object' || first === null) throw new Error('no row');
  const parsed: Record<string, unknown> = {};
  for (const [key, value] of Object.entries(first))
    parsed[key] = typeof value === 'string' ? JSON.parse(value) : value;
  return parsed;
}

async function apply(
  variant: string,
  kind: 'learning' | 'capped' | 'results',
): Promise<Record<string, unknown>> {
  seedLocal();
  const response = await fetch(`http://localhost:8799/api/sync?variant=${variant}`, {
    method: 'POST',
    body: JSON.stringify(generateBatch({ seed: 3, keys: KANA_KEYS, kind })),
  });
  const text = await response.text();
  console.log(
    kind,
    variant,
    response.status,
    text.slice(0, 80),
    response.headers.get('x-bench-meta'),
  );
  return row();
}

let failed = false;
for (const kind of ['learning', 'capped', 'results'] as const) {
  const base = await apply('base', kind);
  const keyed = await apply('keyed', kind);
  for (const column of [...COLUMNS, 'results']) {
    if (!isDeepStrictEqual(base[column], keyed[column])) {
      failed = true;
      console.log(`DIFFERENT: ${kind} ${column}`);
    }
  }
}
for (const part of ['empty', 'floor', 'recent', 'buckets', 'rest']) {
  const response = await fetch(`http://localhost:8799/api/sync?variant=${part}`);
  const text = await response.text();
  JSON.parse(text);
  console.log(part, response.status, text.length, response.headers.get('x-bench-meta'));
}
console.log(failed ? 'FAILED' : 'OK: base and keyed store the same rows');
