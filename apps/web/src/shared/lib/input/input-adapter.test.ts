import { describe, it, expect } from 'vitest';
import { classifyChar, classifyKeyDown, isJapaneseText } from './input-adapter';
import type { KeyDownEventLike } from './input-adapter';

function keyEvent(init: Partial<KeyDownEventLike> & { key: string }): KeyDownEventLike {
  return {
    isComposing: false,
    ctrlKey: false,
    metaKey: false,
    altKey: false,
    ...init,
  };
}

describe('input-adapter: keydown', () => {
  it('maps a Latin letter, dash or apostrophe to a lower-case char', () => {
    expect(classifyKeyDown(keyEvent({ key: 'A' }))).toEqual({ kind: 'char', char: 'a' });
    expect(classifyKeyDown(keyEvent({ key: 'z' }))).toEqual({ kind: 'char', char: 'z' });
    expect(classifyKeyDown(keyEvent({ key: '-' }))).toEqual({ kind: 'char', char: '-' });
    expect(classifyKeyDown(keyEvent({ key: "'" }))).toEqual({ kind: 'char', char: "'" });
  });

  it('a letter of another script is foreign, wherever its key sits (D15)', () => {
    // A Russian layout: the physical key of "a" gives "ф". It is not translated by event.code.
    expect(classifyKeyDown(keyEvent({ key: 'ф' }))).toEqual({ kind: 'foreign' });
    expect(classifyKeyDown(keyEvent({ key: 'Ф' }))).toEqual({ kind: 'foreign' });
    expect(classifyKeyDown(keyEvent({ key: 'ñ' }))).toEqual({ kind: 'foreign' });
    expect(classifyKeyDown(keyEvent({ key: 'か' }))).toEqual({ kind: 'japanese' });
  });

  it('skips the keys of mobile keyboards and of an active IME: the character comes later', () => {
    expect(classifyKeyDown(keyEvent({ key: 'Unidentified' }))).toEqual({ kind: 'ignore' });
    expect(classifyKeyDown(keyEvent({ key: 'Process' }))).toEqual({ kind: 'ignore' });
    expect(classifyKeyDown(keyEvent({ key: 'k', isComposing: true }))).toEqual({ kind: 'ignore' });
  });

  it('Escape is the hint', () => {
    expect(classifyKeyDown(keyEvent({ key: 'Escape' }))).toEqual({ kind: 'reveal' });
  });

  it('ignores modifier combinations', () => {
    for (const modifier of ['ctrlKey', 'metaKey', 'altKey'] as const) {
      expect(classifyKeyDown(keyEvent({ key: 'a', [modifier]: true }))).toEqual({ kind: 'ignore' });
    }
  });

  it('Ctrl+Enter and Cmd+Enter finish a zen test (frontend.md, Keyboard)', () => {
    expect(classifyKeyDown(keyEvent({ key: 'Enter', ctrlKey: true }))).toEqual({ kind: 'finish' });
    expect(classifyKeyDown(keyEvent({ key: 'Enter', metaKey: true }))).toEqual({ kind: 'finish' });
    expect(classifyKeyDown(keyEvent({ key: 'Enter', ctrlKey: true, metaKey: true }))).toEqual({
      kind: 'finish',
    });
  });

  it('any other combination with Enter, and Enter alone, is left to the browser', () => {
    expect(classifyKeyDown(keyEvent({ key: 'Enter' }))).toEqual({ kind: 'ignore' });
    expect(classifyKeyDown(keyEvent({ key: 'Enter', altKey: true }))).toEqual({ kind: 'ignore' });
    // Alt makes it another shortcut (AltGr is Ctrl+Alt on Windows).
    expect(classifyKeyDown(keyEvent({ key: 'Enter', ctrlKey: true, altKey: true }))).toEqual({
      kind: 'ignore',
    });
    expect(classifyKeyDown(keyEvent({ key: 'Enter', isComposing: true, ctrlKey: true }))).toEqual({
      kind: 'ignore',
    });
  });

  it('ignores digits, punctuation, space and named keys', () => {
    for (const key of [
      '1',
      ' ',
      '.',
      ',',
      'Enter',
      'Tab',
      'Backspace',
      'ArrowLeft',
      'F5',
      'Dead',
    ]) {
      expect(classifyKeyDown(keyEvent({ key }))).toEqual({ kind: 'ignore' });
    }
  });
});

describe('input-adapter: text from beforeinput and input', () => {
  it('classifies one character the same way as a key', () => {
    expect(classifyChar('K')).toEqual({ kind: 'char', char: 'k' });
    expect(classifyChar('-')).toEqual({ kind: 'char', char: '-' });
    expect(classifyChar('к')).toEqual({ kind: 'foreign' });
    expect(classifyChar('か')).toEqual({ kind: 'japanese' });
    expect(classifyChar('漢')).toEqual({ kind: 'japanese' });
    expect(classifyChar(' ')).toEqual({ kind: 'ignore' });
    expect(classifyChar('1')).toEqual({ kind: 'ignore' });
  });

  it('takes the typographic apostrophes a mobile keyboard may insert', () => {
    expect(classifyChar('’')).toEqual({ kind: 'char', char: "'" });
    expect(classifyChar('‘')).toEqual({ kind: 'char', char: "'" });
  });

  it('a character that lower-cases to a Latin letter (İ, the Kelvin sign) is not one', () => {
    expect(classifyChar('İ')).toEqual({ kind: 'foreign' });
    expect(classifyChar('\u212a')).toEqual({ kind: 'foreign' });
  });

  it('a string of several characters is not a character', () => {
    expect(classifyChar('ab')).toEqual({ kind: 'ignore' });
  });
});

describe('input-adapter: Japanese composition data', () => {
  it('is true for hiragana, katakana, half-width katakana and kanji', () => {
    for (const text of ['か', 'カ', 'ｶ', '漢', 'kか']) {
      expect(isJapaneseText(text)).toBe(true);
    }
  });

  it('is false for Latin composition (Gboard), digits and Cyrillic', () => {
    for (const text of ['', 'k', 'ka', 'kaki', '1', 'ка']) {
      expect(isJapaneseText(text)).toBe(false);
    }
  });
});
