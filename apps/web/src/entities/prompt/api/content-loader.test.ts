import { describe, it, expect } from 'vitest';
import { chunksFor, loadChunk, loadContent } from './content-loader';

describe('chunksFor', () => {
  it('one chunk for a script, all chunks of the kind for both', () => {
    expect(chunksFor('words', 'hiragana')).toEqual(['words-hiragana']);
    expect(chunksFor('words', 'katakana')).toEqual(['words-katakana']);
    expect(chunksFor('words', 'both')).toEqual(['words-hiragana', 'words-katakana']);
    expect(chunksFor('phrases', 'hiragana')).toEqual(['phrases-hiragana']);
    expect(chunksFor('phrases', 'katakana')).toEqual(['phrases-katakana']);
    expect(chunksFor('phrases', 'both')).toEqual([
      'phrases-hiragana',
      'phrases-katakana',
      'phrases-mixed',
    ]);
  });
});

describe('content-loader', () => {
  it('loads the generated word chunks', async () => {
    const hiragana = await loadContent('words', 'hiragana');
    expect(hiragana.length).toBeGreaterThan(0);
    expect(hiragana.every((item) => item.script === 'hiragana')).toBe(true);
    expect(hiragana[0]?.id).toMatch(/^w:hiragana:/);
    const both = await loadContent('words', 'both');
    expect(both.length).toBeGreaterThan(hiragana.length);
  });

  it('loads phrases; mixed ones come only with both', async () => {
    const hiragana = await loadContent('phrases', 'hiragana');
    expect(hiragana.some((item) => item.script === 'mixed')).toBe(false);
    const both = await loadContent('phrases', 'both');
    expect(both.some((item) => item.script === 'mixed')).toBe(true);
    expect(both.every((item) => item.id.startsWith('p:') && item.tatoebaId !== undefined)).toBe(
      true,
    );
  });

  it('accepts an empty chunk', async () => {
    expect(await loadChunk('phrases-katakana')).toEqual(expect.any(Array));
  });
});
