import { describe, expect, it } from 'vitest';
import { groupTokens } from './token-groups';
import type { StreamToken } from '../model/stream';

function tokens(text: string): StreamToken[] {
  return Array.from(text).map((glyph) => ({ glyph, skip: /[\s、。！？」』）]/.test(glyph) }));
}
function glyphs(text: string): string[] {
  return groupTokens(tokens(text)).map((group) => group.map((t) => t.glyph).join(''));
}

describe('groupTokens', () => {
  it('keeps plain kana apart', () => {
    expect(glyphs('ねこ')).toEqual(['ね', 'こ']);
  });
  it('keeps ー with the kana before it', () => {
    expect(glyphs('コーヒー')).toEqual(['コー', 'ヒー']);
  });
  it('keeps punctuation with the kana before it', () => {
    expect(glyphs('ねこ。')).toEqual(['ね', 'こ。']);
  });
  it('keeps a standalone っ with the kana after it', () => {
    expect(glyphs('っね')).toEqual(['っね']);
  });
  it('keeps an opening bracket with the kana after it', () => {
    expect(glyphs('ね「こ」')).toEqual(['ね', '「こ」']);
  });
  it('lets a line end at a space', () => {
    expect(glyphs('ね こ')).toEqual(['ね', ' ', 'こ']);
  });
  it('gives an empty prompt no groups', () => {
    expect(glyphs('')).toEqual([]);
  });
});
