import { readFileSync } from 'node:fs';
import { isObject } from '@nekotype/shared/runtime';

export interface Source {
  id: string;
  /** The file name in `.cache/` (and in the mirror release). */
  file: string;
  upstream: string;
  mirror: string;
  sha256: string;
  bytes: number;
  /** ISO date (YYYY-MM-DD) the upstream file was downloaded. */
  retrieved: string;
  licence: string;
  note?: string;
}

export interface Sources {
  /** Commit of stephenmk/yomitan-jlpt-vocab the JLPT CSV URLs are pinned to. */
  jlptCommit: string;
  /** Tag of the GitHub release that mirrors the files. */
  release: string;
  sources: Source[];
}

function isSource(value: unknown): value is Source {
  if (!isObject(value)) return false;
  const note = value['note'];
  return (
    typeof value['id'] === 'string' &&
    typeof value['file'] === 'string' &&
    typeof value['upstream'] === 'string' &&
    typeof value['mirror'] === 'string' &&
    typeof value['sha256'] === 'string' &&
    typeof value['bytes'] === 'number' &&
    typeof value['retrieved'] === 'string' &&
    typeof value['licence'] === 'string' &&
    (note === undefined || typeof note === 'string')
  );
}

export function isSources(value: unknown): value is Sources {
  if (!isObject(value)) return false;
  const list = value['sources'];
  return (
    typeof value['jlptCommit'] === 'string' &&
    typeof value['release'] === 'string' &&
    Array.isArray(list) &&
    list.every(isSource)
  );
}

export function parseSources(text: string): Sources {
  const data: unknown = JSON.parse(text);
  if (!isSources(data)) throw new Error('sources.json does not match the Sources shape');
  return data;
}

export function loadSources(): Sources {
  return parseSources(readFileSync(new URL('../sources.json', import.meta.url), 'utf8'));
}
