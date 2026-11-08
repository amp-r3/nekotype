import { describe, it, expect } from 'vitest';
import { kanaOf, kanaRows, similarKana, similarPairs, standaloneRows } from '../data';
import type { Script } from '../types';

const scripts: readonly Script[] = ['hiragana', 'katakana'];

describe('tracks', () => {
  it('has 104 hiragana and 125 katakana, without duplicates', () => {
    expect(kanaOf('hiragana')).toHaveLength(104);
    expect(kanaOf('katakana')).toHaveLength(125);
    for (const script of scripts) {
      expect(new Set(kanaOf(script)).size).toBe(kanaOf(script).length);
    }
  });

  it('starts with the five vowels', () => {
    expect(kanaOf('hiragana').slice(0, 5)).toEqual(['あ', 'い', 'う', 'え', 'お']);
    expect(kanaOf('katakana').slice(0, 5)).toEqual(['ア', 'イ', 'ウ', 'エ', 'オ']);
  });

  it('leaves out the extended rows in hiragana only', () => {
    expect(kanaRows('hiragana').some((row) => row.category === 'extended')).toBe(false);
    expect(kanaRows('katakana').filter((row) => row.category === 'extended')).toHaveLength(5);
    expect(kanaRows('hiragana')).toHaveLength(26);
    expect(kanaRows('katakana')).toHaveLength(31);
  });

  it('rows concatenate to the track', () => {
    for (const script of scripts) {
      expect(kanaRows(script).flatMap((row) => row.kana)).toEqual(kanaOf(script));
    }
  });

  it('has no standalone kana', () => {
    const standalone = standaloneRows.flatMap((row) =>
      row.entries.flatMap((e) => [e.hiragana, e.katakana]),
    );
    for (const script of scripts) {
      for (const kana of kanaOf(script)) expect(standalone).not.toContain(kana);
    }
  });
});

describe('similar kana', () => {
  it('refers to kana of the same script that are in the track', () => {
    for (const script of scripts) {
      const track = new Set(kanaOf(script));
      for (const [a, b] of similarPairs[script]) {
        expect(track.has(a), `${script}: ${a}`).toBe(true);
        expect(track.has(b), `${script}: ${b}`).toBe(true);
        expect(a).not.toBe(b);
      }
    }
  });

  it('has no duplicate pairs', () => {
    for (const script of scripts) {
      const keys = similarPairs[script].map(([a, b]) => [a, b].sort().join('/'));
      expect(new Set(keys).size).toBe(keys.length);
    }
  });

  it('is symmetric', () => {
    for (const script of scripts) {
      for (const [a, b] of similarPairs[script]) {
        expect(similarKana(a)).toContain(b);
        expect(similarKana(b)).toContain(a);
      }
    }
  });

  it('knows the pairs named in the spec', () => {
    expect(similarKana('さ')).toContain('ち');
    expect(similarKana('わ')).toEqual(expect.arrayContaining(['ね', 'れ']));
    expect(similarKana('シ')).toContain('ツ');
    expect(similarKana('ソ')).toContain('ン');
  });

  it('is empty for a kana without a look-alike', () => {
    expect(similarKana('か')).toEqual([]);
    expect(similarKana('x')).toEqual([]);
  });
});
