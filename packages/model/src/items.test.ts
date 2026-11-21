import { describe, expect, it } from 'vitest';
import { ITEMS, kanaOfReading, trackItems, trackRows } from './items';

const parts = (key: Parameters<typeof ITEMS.get>[0]) => ITEMS.get(key)?.parts;

describe('items', () => {
  it('holds 104 hiragana and 125 katakana, 46 basic each', () => {
    expect(trackItems('hiragana')).toHaveLength(104);
    expect(trackItems('katakana')).toHaveLength(125);
    expect(ITEMS.size).toBe(229);
    for (const track of ['hiragana', 'katakana'] as const) {
      expect(trackItems(track).filter((item) => item.category === 'basic')).toHaveLength(46);
    }
  });

  it('keys items as the app does and numbers them per track', () => {
    expect(ITEMS.get('hiragana:か')).toMatchObject({
      kana: 'か',
      track: 'hiragana',
      row: 'hiragana:k',
      category: 'basic',
    });
    for (const track of ['hiragana', 'katakana'] as const) {
      expect(trackItems(track).map((item) => item.index)).toEqual(
        trackItems(track).map((_, at) => at),
      );
    }
    expect(trackItems('hiragana')[0]?.key).toBe('hiragana:あ');
    expect(trackItems('katakana')[0]?.key).toBe('katakana:ア');
  });

  it('lists the rows of a track in table order', () => {
    const rows = trackRows('hiragana');
    expect(rows[0]).toEqual({
      id: 'hiragana:vowels',
      keys: ['あ', 'い', 'う', 'え', 'お'].map((kana) => `hiragana:${kana}`),
    });
    expect(rows.flatMap((row) => row.keys)).toEqual(trackItems('hiragana').map((item) => item.key));
  });

  it('derives the parts of a kana', () => {
    expect(parts('hiragana:あ')).toEqual([]);
    expect(parts('hiragana:が')).toEqual(['hiragana:か']);
    expect(parts('hiragana:ぱ')).toEqual(['hiragana:は']);
    expect(parts('hiragana:きゃ')).toEqual(['hiragana:き', 'hiragana:や']);
    expect(parts('katakana:ヴァ')).toEqual(['katakana:ヴ', 'katakana:ア']);
    expect(parts('katakana:ヴ')).toEqual(['katakana:ウ']);
    for (const item of ITEMS.values()) {
      for (const part of item.parts) expect(ITEMS.get(part)?.track).toBe(item.track);
    }
  });

  it('pairs a katakana with its hiragana in both directions', () => {
    for (const item of trackItems('katakana')) {
      const hira = `hiragana:${String.fromCodePoint(
        ...Array.from(item.kana).map((char) => (char.codePointAt(0) ?? 0) - 0x60),
      )}` as const;
      if (ITEMS.has(hira)) {
        expect(item.pair, item.key).toBe(hira);
        expect(ITEMS.get(hira)?.pair, hira).toBe(item.key);
      } else {
        expect(item.pair, item.key).toBeNull();
      }
    }
    expect(ITEMS.get('katakana:ア')?.pair).toBe('hiragana:あ');
    expect(ITEMS.get('katakana:ヴ')?.pair).toBeNull();
    expect(ITEMS.get('hiragana:ん')?.pair).toBe('katakana:ン');
  });

  it('reads a reading as the longest kana first', () => {
    expect(kanaOfReading('きょうと')).toEqual(['hiragana:きょ', 'hiragana:う', 'hiragana:と']);
    expect(kanaOfReading('ヴァイオリン')).toEqual([
      'katakana:ヴァ',
      'katakana:イ',
      'katakana:オ',
      'katakana:リ',
      'katakana:ン',
    ]);
    expect(kanaOfReading('a漢か')).toEqual(['hiragana:か']);
    expect(kanaOfReading('')).toEqual([]);
  });
});
