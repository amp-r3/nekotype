import { describe, it, expect } from 'vitest';
import { readFileSync } from 'node:fs';
import { basicRows, dakutenRows, yoonRows, extendedRows, standaloneRows } from './index';
import { rowsOf, standaloneOf } from './notation';

// The tables as they were written out in full before the compact notation (generated from them
// once). A change to the table updates this file in the same commit.
const fixture: unknown = JSON.parse(
  readFileSync(new URL('./fixtures/kana-table.json', import.meta.url), 'utf-8'),
);

describe('kana table notation', () => {
  it('expands to the same tables as the full form', () => {
    expect({ basicRows, dakutenRows, yoonRows, extendedRows, standaloneRows }).toEqual(fixture);
  });

  it('reads hiragana and katakana, IME spellings and learner spellings', () => {
    expect(rowsOf('yoon', [['ch', 'ちゃチャ cha,tya/cya']])).toEqual([
      {
        id: 'ch',
        name: 'Cha',
        category: 'yoon',
        entries: [{ hiragana: 'ちゃ', katakana: 'チャ', ime: ['cha', 'tya'], learner: ['cya'] }],
      },
    ]);
  });

  it('leaves out hiragana for a katakana-only entry', () => {
    const [row] = rowsOf('extended', [['ext_fa', 'ファ fa/fua,huxa|フィ fi']]);
    expect(row?.entries).toEqual([
      { katakana: 'ファ', ime: ['fa'], learner: ['fua', 'huxa'] },
      { katakana: 'フィ', ime: ['fi'], learner: [] },
    ]);
    expect(row?.entries[0]).not.toHaveProperty('hiragana');
  });

  it('names a row after its canonical spellings unless it has a name of its own', () => {
    const [named, own] = rowsOf('basic', [
      ['k', 'かカ ka|きキ ki'],
      ['w_n', 'わワ wa|んン nn,n', 'Wa - N'],
    ]);
    expect(named?.name).toBe('Ka - Ki');
    expect(own?.name).toBe('Wa - N');
  });

  it('builds a standalone row', () => {
    expect(standaloneOf('archaic', 'ゐヰ wyi')).toEqual({
      id: 'archaic',
      entries: [{ hiragana: 'ゐ', katakana: 'ヰ', ime: ['wyi'], learner: [] }],
    });
  });
});
