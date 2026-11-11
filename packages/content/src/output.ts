import { createHash } from 'node:crypto';
import { gzipSync } from 'node:zlib';
import type { ContentItem, ContentScript, PhraseCredit } from './types';

/** The gzip limit of one chunk (content.md, "Build checks"). */
export const CHUNK_GZIP_LIMIT = 40 * 1024;

export const CHUNK_FILES = [
  'words-hiragana.json',
  'words-katakana.json',
  'phrases-hiragana.json',
  'phrases-katakana.json',
  'phrases-mixed.json',
  'credits.json',
] as const;

export type ChunkFile = (typeof CHUNK_FILES)[number];

export interface ContentManifest {
  contentVersion: string;
  counts: Record<string, number>;
}

function sortKeys(value: unknown): unknown {
  if (Array.isArray(value)) return value.map(sortKeys);
  if (typeof value === 'object' && value !== null) {
    const entries = Object.entries(value).sort(([a], [b]) => (a < b ? -1 : a > b ? 1 : 0));
    return Object.fromEntries(entries.map(([key, v]) => [key, sortKeys(v)]));
  }
  return value;
}

/** C11: sorted keys, 2-space indentation, a final newline. */
export function serialize(value: unknown): string {
  return `${JSON.stringify(sortKeys(value), null, 2)}\n`;
}

/** C11: first 12 hex digits of sha256 over `<name>\n<bytes>\n` for sources.json, then each chunk by name. */
export function contentVersion(sourcesJson: string, chunks: ReadonlyMap<string, string>): string {
  const hash = createHash('sha256');
  hash.update(`sources.json\n${sourcesJson}\n`);
  for (const name of [...chunks.keys()].sort()) hash.update(`${name}\n${chunks.get(name)}\n`);
  return hash.digest('hex').slice(0, 12);
}

export interface ChunkInput {
  words: Record<'hiragana' | 'katakana', ContentItem[]>;
  phrases: Record<ContentScript, ContentItem[]>;
  credits: PhraseCredit[];
}

/** The serialised chunk files by name, without the manifest. */
export function serializeChunks(input: ChunkInput): Map<ChunkFile, string> {
  return new Map<ChunkFile, string>([
    ['words-hiragana.json', serialize(input.words.hiragana)],
    ['words-katakana.json', serialize(input.words.katakana)],
    ['phrases-hiragana.json', serialize(input.phrases.hiragana)],
    ['phrases-katakana.json', serialize(input.phrases.katakana)],
    ['phrases-mixed.json', serialize(input.phrases.mixed)],
    ['credits.json', serialize(input.credits)],
  ]);
}

export function chunkCounts(input: ChunkInput): Record<string, number> {
  return {
    'words-hiragana': input.words.hiragana.length,
    'words-katakana': input.words.katakana.length,
    'phrases-hiragana': input.phrases.hiragana.length,
    'phrases-katakana': input.phrases.katakana.length,
    'phrases-mixed': input.phrases.mixed.length,
    credits: input.credits.length,
  };
}

export interface ChunkSize {
  raw: number;
  gzip: number;
}

export function chunkSizes(chunks: ReadonlyMap<string, string>): Record<string, ChunkSize> {
  const sizes: Record<string, ChunkSize> = {};
  for (const [name, text] of chunks) {
    sizes[name] = { raw: Buffer.byteLength(text), gzip: gzipSync(text).length };
  }
  return sizes;
}

/** Throws when a chunk exceeds the gzip limit. */
export function checkChunkSizes(sizes: Readonly<Record<string, ChunkSize>>): void {
  for (const [name, { gzip }] of Object.entries(sizes)) {
    if (gzip > CHUNK_GZIP_LIMIT) {
      throw new Error(`Chunk ${name} is ${gzip} bytes gzip, the limit is ${CHUNK_GZIP_LIMIT}`);
    }
  }
}

/** Throws when compile failures exceed 5% of a source's selected items (content.md, "Build checks"). */
export function checkCompileFailures(source: string, failed: number, base: number): void {
  if (failed > base * 0.05) {
    throw new Error(`${source}: compile failures ${failed} exceed 5% of ${base}`);
  }
}

/** The manifest of the chunks; the build serialises it as `manifest.json`. */
export function buildManifest(
  sourcesJson: string,
  chunks: ReadonlyMap<string, string>,
  counts: Record<string, number>,
): ContentManifest {
  return { contentVersion: contentVersion(sourcesJson, chunks), counts };
}

export function sha256(text: string): string {
  return createHash('sha256').update(text).digest('hex');
}
