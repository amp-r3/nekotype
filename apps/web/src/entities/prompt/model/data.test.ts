import { describe, it, expect } from 'vitest';
import { readFileSync, readdirSync, existsSync } from 'node:fs';
import { join } from 'node:path';
import { allKanaRows } from './data';
import { chunksFor, loadContent } from '../api/content-loader';
import { compile, canonical } from '../lib/engine';
import type { PromptItem } from './types';

const words = await loadContent('words', 'both');
const phrases = await loadContent('phrases', 'both');

describe('data integrity: generated content', () => {
  it('content ids unique', () => {
    const idSet = new Set<string>();
    for (const item of [...words, ...phrases]) {
      expect(idSet.has(item.id)).toBe(false);
      idSet.add(item.id);
    }
  });

  it('every content item has a non-empty English meaning', () => {
    for (const item of [...words, ...phrases]) {
      expect(item.meaning.en.trim().length).toBeGreaterThan(0);
    }
  });

  it('every phrase links to its Tatoeba sentence; words do not', () => {
    for (const item of phrases) expect(item.id).toBe(`p:${item.tatoebaId}`);
    for (const item of words) expect(item.tatoebaId).toBeUndefined();
  });

  it('chunks hold the script of their name; mixed is for phrases only', () => {
    expect(words.some((w) => w.script === 'mixed')).toBe(false);
    expect(phrases.some((p) => p.script === 'mixed')).toBe(true);
    expect(chunksFor('words', 'both')).not.toContain('phrases-mixed');
  });

  it('content pools per script: words >= 3, phrases offered for hiragana and with both', () => {
    expect(words.filter((w) => w.script === 'hiragana').length).toBeGreaterThanOrEqual(3);
    expect(words.filter((w) => w.script === 'katakana').length).toBeGreaterThanOrEqual(3);
    expect(phrases.filter((p) => p.script === 'hiragana').length).toBeGreaterThanOrEqual(3);
  });

  it('all words/phrases compile in both strictness modes', () => {
    for (const item of [...words, ...phrases]) {
      const prompt: PromptItem = {
        key: item.id,
        text: item.text,
        ...(item.readingHints ? { readingHints: item.readingHints } : {}),
      };
      for (const mode of ['learner', 'ime'] as const) {
        const compiled = compile([prompt], mode);
        expect(compiled.tokens.length).toBeGreaterThan(0);
        expect(canonical(compiled, 0).length).toBeGreaterThan(0);
      }
    }
  });
});

describe('data integrity: font glyphs sync', () => {
  it('glyphs.txt in sync with the data', () => {
    const glyphsPath = join(process.cwd(), 'glyphs.txt');
    expect(existsSync(glyphsPath)).toBe(true);
    const committedGlyphs = readFileSync(glyphsPath, 'utf-8');

    const expectedSet = new Set<string>();
    const mandatoryChars = 'ーっッゃゅょャュョァィゥェォ、。';
    for (const ch of mandatoryChars) expectedSet.add(ch);

    for (const row of allKanaRows) {
      for (const entry of row.entries) {
        if (entry.hiragana) {
          for (const ch of entry.hiragana) expectedSet.add(ch);
        }
        for (const ch of entry.katakana) expectedSet.add(ch);
      }
    }

    // C12: the generated chunks, not the typing screen reads them.
    const contentDir = join(process.cwd(), 'src/entities/prompt/content');
    const chunkFiles = readdirSync(contentDir).filter((f) => /^(words|phrases)-.*\.json$/.test(f));
    expect(chunkFiles).toHaveLength(5);
    for (const file of chunkFiles) {
      const parsed: unknown = JSON.parse(readFileSync(join(contentDir, file), 'utf-8'));
      if (!Array.isArray(parsed)) throw new Error(`${file} is not an array`);
      const items: unknown[] = parsed;
      for (const item of items) {
        if (
          typeof item !== 'object' ||
          item === null ||
          !('text' in item) ||
          typeof item.text !== 'string'
        ) {
          throw new Error(`${file}: bad item`);
        }
        for (const ch of item.text) expectedSet.add(ch);
      }
    }

    const expectedSorted = Array.from(expectedSet).sort().join('');
    expect(committedGlyphs).toBe(expectedSorted);
  });
});
