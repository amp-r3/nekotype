import { describe, it, expect } from 'vitest';
import { readFileSync, readdirSync, existsSync } from 'node:fs';
import { join } from 'node:path';
import { allKanaRows } from './data';

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

    // C12: the glyphs of the generated chunks (no screen loads them before P10) are in the font subset.
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
