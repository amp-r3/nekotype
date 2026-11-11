import { spawn } from 'node:child_process';
import { createReadStream } from 'node:fs';
import { createInterface } from 'node:readline';
import type { Readable } from 'node:stream';
import { createGunzip } from 'node:zlib';

function open(path: string): Readable {
  if (path.endsWith('.bz2')) {
    // The system bzip2: no dependency, and the build runs by hand on Linux (never in CI).
    const child = spawn('bzip2', ['-dc', path], { stdio: ['ignore', 'pipe', 'inherit'] });
    child.on('error', (error) => child.stdout.destroy(error));
    child.on('close', (code) => {
      if (code !== 0) child.stdout.destroy(new Error(`bzip2 -dc ${path} exited with ${code}`));
    });
    return child.stdout;
  }
  const file = createReadStream(path);
  if (path.endsWith('.gz')) {
    const gunzip = createGunzip();
    file.on('error', (error) => gunzip.destroy(error));
    return file.pipe(gunzip);
  }
  return file;
}

/** Streams the lines of a plain, `.gz` or `.bz2` text file. */
export async function* readLines(path: string): AsyncGenerator<string> {
  const lines = createInterface({ input: open(path), crlfDelay: Infinity });
  try {
    for await (const line of lines) {
      if (line !== '') yield line;
    }
  } finally {
    lines.close();
  }
}

/** Streams the rows of a tab-separated file (Tatoeba exports, `users_sentences.csv`). */
export async function* readTsv(path: string): AsyncGenerator<string[]> {
  for await (const line of readLines(path)) yield line.split('\t');
}

/** Tatoeba writes a missing value as `\N`. */
export function nullable(field: string | undefined): string | null {
  return field === undefined || field === '\\N' || field === '' ? null : field;
}
