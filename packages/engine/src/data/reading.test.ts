import { describe, expect, it } from 'vitest';
import type { Script } from '../types';
import { readingTokens, type ReadingToken } from './reading';

const kana = (text: string, script: Script = 'hiragana'): ReadingToken => ({
  kind: 'kana',
  kana: text,
  script,
});
const sokuon: ReadingToken = { kind: 'sokuon' };
const choon: ReadingToken = { kind: 'choon' };

describe('readingTokens', () => {
  it('takes a yōon as one kana', () => {
    expect(readingTokens('きゃく')).toEqual([kana('きゃ'), kana('く')]);
  });

  it('takes an extended katakana as one kana', () => {
    expect(readingTokens('ファン')).toEqual([kana('ファ', 'katakana'), kana('ン', 'katakana')]);
  });

  it('never merges っ with the kana after it', () => {
    expect(readingTokens('きって')).toEqual([kana('き'), sokuon, kana('て')]);
    expect(readingTokens('まっちゃ')).toEqual([kana('ま'), sokuon, kana('ちゃ')]);
  });

  it('gives a standalone っ and ッ their own token', () => {
    expect(readingTokens('あっ')).toEqual([kana('あ'), sokuon]);
    expect(readingTokens('ッ')).toEqual([sokuon]);
  });

  it('gives ー its own token', () => {
    expect(readingTokens('コーヒー')).toEqual([
      kana('コ', 'katakana'),
      choon,
      kana('ヒ', 'katakana'),
      choon,
    ]);
  });

  it.each(['ゃ', 'きぁ', 'ァ', 'ゐ', 'ゑ', 'ヶ', 'ねこ。', 'neko'])(
    'is null for %s: a character outside the selectable rows',
    (text) => {
      expect(readingTokens(text)).toBeNull();
    },
  );

  it('is empty for an empty string', () => {
    expect(readingTokens('')).toEqual([]);
  });
});
