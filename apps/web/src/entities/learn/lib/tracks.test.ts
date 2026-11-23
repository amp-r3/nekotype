import { describe, it, expect } from 'vitest';
import { kanaOf } from '@nekotype/engine';
import type { Track } from '@nekotype/shared/types';
import { dependenciesOf, keyOf, keysOfTrack } from './tracks';

const TRACK_LIST: readonly Track[] = ['hiragana', 'katakana'];

describe('track composition', () => {
  it('has 104 hiragana and 125 katakana, none of the unlearned kana', () => {
    expect(keysOfTrack('hiragana')).toHaveLength(104);
    expect(keysOfTrack('katakana')).toHaveLength(125);
    for (const track of TRACK_LIST) {
      const kana = kanaOf(track);
      for (const unlearned of ['っ', 'ッ', 'ー', 'ゃ', 'ャ', 'ぁ', 'ァ', 'ゐ', 'ゑ', 'ヰ', 'ヱ']) {
        expect(kana).not.toContain(unlearned);
      }
    }
  });
  it('starts with the five vowels', () => {
    expect(
      keysOfTrack('hiragana')
        .slice(0, 5)
        .map((k) => k.slice(-1))
        .join(''),
    ).toBe('あいうえお');
    expect(
      keysOfTrack('katakana')
        .slice(0, 5)
        .map((k) => k.slice(-1))
        .join(''),
    ).toBe('アイウエオ');
  });
});

describe('dependenciesOf', () => {
  it('finds the base of a dakuten or handakuten kana', () => {
    expect(dependenciesOf('hiragana', 'が')).toEqual([keyOf('hiragana', 'か')]);
    expect(dependenciesOf('hiragana', 'ぱ')).toEqual([keyOf('hiragana', 'は')]);
    expect(dependenciesOf('katakana', 'ヴ')).toEqual([keyOf('katakana', 'ウ')]);
  });
  it('uses the full-size form of each character of a two-character kana', () => {
    expect(dependenciesOf('hiragana', 'きゃ')).toEqual([
      keyOf('hiragana', 'き'),
      keyOf('hiragana', 'や'),
    ]);
    expect(dependenciesOf('katakana', 'ファ')).toEqual([
      keyOf('katakana', 'フ'),
      keyOf('katakana', 'ア'),
    ]);
    expect(dependenciesOf('katakana', 'ヴァ')).toEqual([
      keyOf('katakana', 'ヴ'),
      keyOf('katakana', 'ア'),
    ]);
    expect(dependenciesOf('hiragana', 'ぎゃ')).toEqual([
      keyOf('hiragana', 'ぎ'),
      keyOf('hiragana', 'や'),
    ]);
  });
  it('has none for a plain kana', () => {
    expect(dependenciesOf('hiragana', 'か')).toEqual([]);
  });
  it('refers to kana of the same track only', () => {
    for (const track of TRACK_LIST) {
      const keys = new Set(keysOfTrack(track));
      for (const kana of kanaOf(track)) {
        for (const dep of dependenciesOf(track, kana)) expect(keys.has(dep)).toBe(true);
      }
    }
  });
});
