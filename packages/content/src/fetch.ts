import { createHash } from 'node:crypto';
import { createReadStream, createWriteStream, existsSync } from 'node:fs';
import { mkdir, rename, stat, writeFile } from 'node:fs/promises';
import { pipeline } from 'node:stream/promises';
import { createGzip } from 'node:zlib';
import { loadSources, type Source } from './sources';

const CACHE = new URL('../.cache/', import.meta.url);
const UPSTREAM = new URL('upstream/', CACHE);

export async function sha256File(path: URL): Promise<string> {
  const hash = createHash('sha256');
  await pipeline(createReadStream(path), hash);
  return hash.digest('hex');
}

async function* chunks(body: ReadableStream<Uint8Array>): AsyncGenerator<Uint8Array> {
  const reader = body.getReader();
  for (;;) {
    const { done, value } = await reader.read();
    if (done) return;
    yield value;
  }
}

async function download(url: string, to: URL): Promise<void> {
  const response = await fetch(url, { redirect: 'follow' });
  if (!response.ok || response.body === null) {
    throw new Error(`GET ${url}: HTTP ${response.status}`);
  }
  const tmp = new URL(`${to.href}.part`);
  await pipeline(chunks(response.body), createWriteStream(tmp));
  await rename(tmp, to);
}

async function fetchMirror(source: Source): Promise<void> {
  const target = new URL(source.file, CACHE);
  if (existsSync(target) && (await sha256File(target)) === source.sha256) {
    console.log(`ok       ${source.file} (cached)`);
    return;
  }
  console.log(`download ${source.file}`);
  await download(source.mirror, target);
  const actual = await sha256File(target);
  if (actual !== source.sha256) {
    throw new Error(
      `${source.file}: sha256 ${actual} does not match sources.json ${source.sha256}`,
    );
  }
  console.log(`ok       ${source.file}`);
}

async function gzipTo(from: URL, to: URL): Promise<void> {
  await pipeline(createReadStream(from), createGzip({ level: 9 }), createWriteStream(to));
}

/** The upstream URL serves `users_sentences.csv`; the mirror keeps it gzip-compressed. */
async function fetchUpstreamFile(source: Source): Promise<URL> {
  const target = new URL(source.file, UPSTREAM);
  if (existsSync(target)) {
    console.log(`present  ${source.file}`);
    return target;
  }
  const gzipped = source.file.endsWith('.gz') && !source.upstream.endsWith('.gz');
  if (gzipped) {
    const raw = new URL(source.file.slice(0, -'.gz'.length), UPSTREAM);
    if (!existsSync(raw)) {
      console.log(`download ${source.upstream}`);
      await download(source.upstream, raw);
    }
    console.log(`gzip     ${source.file}`);
    await gzipTo(raw, target);
    return target;
  }
  try {
    console.log(`download ${source.upstream}`);
    await download(source.upstream, target);
  } catch (error) {
    console.error(String(error));
    console.error(
      `Download it by hand from ${source.upstream} and put it at ${target.pathname}, then run this again.`,
    );
  }
  return target;
}

async function upstream(): Promise<void> {
  await mkdir(UPSTREAM, { recursive: true });
  const { sources, release } = loadSources();
  const lines: string[] = [];
  const files: string[] = [];
  for (const source of sources) {
    const path = await fetchUpstreamFile(source);
    if (!existsSync(path)) {
      console.warn(`missing  ${source.file}: skipped`);
      continue;
    }
    const sha = await sha256File(path);
    const { size } = await stat(path);
    lines.push(`${source.id}\t${source.file}\t${sha}\t${size}`);
    files.push(path.pathname);
  }
  console.log('\nid\tfile\tsha256\tbytes');
  console.log(lines.join('\n'));
  console.log(
    `\nMirror (after the maintainer confirms; write the notes file first):\n` +
      `gh release create ${release} --repo amp-r3/nekotype --title ${release} ` +
      `--notes-file <notes.md> ${files.join(' ')}`,
  );
  await writeFile(new URL('upstream-report.tsv', UPSTREAM), `${lines.join('\n')}\n`);
}

async function main(): Promise<void> {
  await mkdir(CACHE, { recursive: true });
  if (process.argv.includes('--upstream')) {
    await upstream();
    return;
  }
  for (const source of loadSources().sources) await fetchMirror(source);
}

if (
  process.argv[1] !== undefined &&
  import.meta.url === new URL(`file://${process.argv[1]}`).href
) {
  main().catch((error: unknown) => {
    console.error(error);
    process.exitCode = 1;
  });
}
