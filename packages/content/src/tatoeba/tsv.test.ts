import { spawnSync } from 'node:child_process';
import { mkdtempSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { gzipSync } from 'node:zlib';
import { describe, expect, it } from 'vitest';
import { nullable, readLines, readTsv } from './tsv';

const dir = mkdtempSync(join(tmpdir(), 'nekotype-tsv-'));
const text = '1\tjpn\tこんにちは。\tuser\n\n2\teng\tHello.\t\\N\n';

async function collect<T>(it: AsyncIterable<T>): Promise<T[]> {
  const out: T[] = [];
  for await (const x of it) out.push(x);
  return out;
}

describe('readTsv', () => {
  it('reads a plain file and skips empty lines', async () => {
    const path = join(dir, 'a.tsv');
    writeFileSync(path, text);
    expect(await collect(readTsv(path))).toEqual([
      ['1', 'jpn', 'こんにちは。', 'user'],
      ['2', 'eng', 'Hello.', '\\N'],
    ]);
  });

  it('reads a gzip file', async () => {
    const path = join(dir, 'a.tsv.gz');
    writeFileSync(path, gzipSync(text));
    expect(await collect(readLines(path))).toHaveLength(2);
  });

  const hasBzip2 = spawnSync('bzip2', ['--help']).error === undefined;
  it.runIf(hasBzip2)('reads a bz2 file through the system bzip2', async () => {
    const plain = join(dir, 'b.tsv');
    writeFileSync(plain, text);
    spawnSync('bzip2', ['-k', plain]);
    expect(await collect(readLines(`${plain}.bz2`))).toHaveLength(2);
  });

  it('fails on a missing file', async () => {
    await expect(collect(readLines(join(dir, 'missing.tsv.gz')))).rejects.toThrow();
  });
});

describe('nullable', () => {
  it('maps \\N and empty to null', () => {
    expect(nullable('\\N')).toBeNull();
    expect(nullable('')).toBeNull();
    expect(nullable(undefined)).toBeNull();
    expect(nullable('gillux')).toBe('gillux');
  });
});
