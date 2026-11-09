import { describe, it, expect } from 'vitest';
import { displayRomaji } from './romaji';
import { keyOf } from '@/entities/learn';

describe('displayRomaji', () => {
  it('is the canonical spelling of the table', () => {
    expect(displayRomaji(keyOf('hiragana', 'あ'))).toBe('a');
    expect(displayRomaji(keyOf('hiragana', 'し'))).toBe('shi');
    expect(displayRomaji(keyOf('hiragana', 'ふ'))).toBe('fu');
    expect(displayRomaji(keyOf('hiragana', 'きゃ'))).toBe('kya');
    expect(displayRomaji(keyOf('katakana', 'ティ'))).toBe('thi');
  });

  it('shows ん and ン as n: one n ends a task, so nn would teach a keystroke nobody needs', () => {
    expect(displayRomaji(keyOf('hiragana', 'ん'))).toBe('n');
    expect(displayRomaji(keyOf('katakana', 'ン'))).toBe('n');
    // The kana that only start with n keep their spelling.
    expect(displayRomaji(keyOf('hiragana', 'な'))).toBe('na');
  });
});
