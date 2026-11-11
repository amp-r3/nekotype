import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';
import {
  CHUNK_FILES,
  CHUNK_GZIP_LIMIT,
  buildManifest,
  checkChunkSizes,
  checkCompileFailures,
  contentVersion,
  serialize,
} from './output';

const OUT = new URL('../../../apps/web/src/entities/prompt/content/', import.meta.url);
const SOURCES = new URL('../sources.json', import.meta.url);

describe('serialize', () => {
  it('sorts keys at every depth, indents by 2 and ends with a newline', () => {
    expect(serialize({ b: 1, a: { d: [{ z: 1, y: 2 }], c: null } })).toBe(
      '{\n  "a": {\n    "c": null,\n    "d": [\n      {\n        "y": 2,\n        "z": 1\n      }\n    ]\n  },\n  "b": 1\n}\n',
    );
  });

  it('gives the same bytes for the same value on a second run', () => {
    const value = { b: [1, 2], a: 'あ' };
    expect(serialize(value)).toBe(serialize(value));
  });
});

describe('build checks', () => {
  it('fails above 5% compile failures and passes at 5%', () => {
    expect(() => {
      checkCompileFailures('words', 5, 100);
    }).not.toThrow();
    expect(() => {
      checkCompileFailures('words', 6, 100);
    }).toThrow(/exceed 5%/);
  });

  it('fails when a chunk is over the gzip limit', () => {
    expect(() => {
      checkChunkSizes({ a: { raw: 1, gzip: CHUNK_GZIP_LIMIT } });
    }).not.toThrow();
    expect(() => {
      checkChunkSizes({ a: { raw: 1, gzip: CHUNK_GZIP_LIMIT + 1 } });
    }).toThrow(/limit/);
  });
});

describe('contentVersion (C11)', () => {
  it('is 12 hex digits and changes with a source or a chunk', () => {
    const chunks = new Map([['a.json', '[]\n']]);
    const base = contentVersion('{}', chunks);
    expect(base).toMatch(/^[0-9a-f]{12}$/);
    expect(contentVersion('{ }', chunks)).not.toBe(base);
    expect(contentVersion('{}', new Map([['a.json', '[1]\n']]))).not.toBe(base);
  });

  it('does not depend on the insertion order of the chunks', () => {
    const a = new Map([
      ['a.json', '1'],
      ['b.json', '2'],
    ]);
    const b = new Map([
      ['b.json', '2'],
      ['a.json', '1'],
    ]);
    expect(contentVersion('{}', a)).toBe(contentVersion('{}', b));
  });

  it('matches manifest.json recomputed from the committed files', () => {
    const chunks = new Map(CHUNK_FILES.map((f) => [f, readFileSync(new URL(f, OUT), 'utf8')]));
    const manifest: unknown = JSON.parse(readFileSync(new URL('manifest.json', OUT), 'utf8'));
    const recomputed = buildManifest(readFileSync(SOURCES, 'utf8'), chunks, {});
    expect(manifest).toMatchObject({ contentVersion: recomputed.contentVersion });
  });

  it('keeps every committed file as the build serialises it', () => {
    for (const name of [...CHUNK_FILES, 'manifest.json']) {
      const text = readFileSync(new URL(name, OUT), 'utf8');
      expect(serialize(JSON.parse(text))).toBe(text);
    }
  });
});
