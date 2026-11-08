import { describe, it, expect } from 'vitest';
import { kanaOf } from '@nekotype/engine';
import type { Track } from '@nekotype/shared/types';
import { dependenciesOf, initialUnlocked, keyOf, keysOfTrack, nextUnlock } from './tracks';

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
      initialUnlocked('hiragana')
        .map((k) => k.slice(-1))
        .join(''),
    ).toBe('あいうえお');
    expect(
      initialUnlocked('katakana')
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

describe('nextUnlock', () => {
  const allConfident = () => true;
  it('is the first locked kana when the unlocked ones are confident', () => {
    expect(nextUnlock('hiragana', initialUnlocked('hiragana'), allConfident)).toBe(
      keyOf('hiragana', 'か'),
    );
  });
  it('waits while any unlocked kana is not confident', () => {
    const slow = keyOf('hiragana', 'い');
    expect(nextUnlock('hiragana', initialUnlocked('hiragana'), (k) => k !== slow)).toBeNull();
  });
  it('unlocks ヴ before ヴァ and ヴィ', () => {
    const katakana = keysOfTrack('katakana');
    const va = keyOf('katakana', 'ヴァ');
    const vu = keyOf('katakana', 'ヴ');
    const before = katakana.slice(0, katakana.indexOf(va));
    const open = new Set(before);
    // Only the unlocked kana are confident, so ヴァ waits for ヴ.
    expect(nextUnlock('katakana', before, (key) => open.has(key))).toBe(vu);
  });
  it('is null when the track is complete', () => {
    expect(nextUnlock('hiragana', keysOfTrack('hiragana'), allConfident)).toBeNull();
  });
});
