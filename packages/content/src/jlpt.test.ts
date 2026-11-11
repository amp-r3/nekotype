import { describe, expect, it } from 'vitest';
import { parseCsv, parseJlpt } from './jlpt';

describe('parseCsv', () => {
  it('handles quoted commas, escaped quotes, newlines in quotes and CRLF', () => {
    expect(parseCsv('a,"b, c","say ""hi""","x\ny"\r\n1,2,3,4\n')).toEqual([
      ['a', 'b, c', 'say "hi"', 'x\ny'],
      ['1', '2', '3', '4'],
    ]);
  });

  it('keeps empty fields and a last row without a newline', () => {
    expect(parseCsv('a,,c\n,,')).toEqual([
      ['a', '', 'c'],
      ['', '', ''],
    ]);
  });

  it('rejects an unterminated quote', () => {
    expect(() => parseCsv('a,"b')).toThrow(/unterminated/);
  });
});

describe('parseJlpt', () => {
  it('reads rows in file order', () => {
    const rows = parseJlpt(
      'jmdict_seq,kana,kanji,waller_definition\n1004500,こちら,,"this way, here"\n1004500,こっち,,this side\n',
    );
    expect(rows).toEqual([
      { seq: 1004500, kana: 'こちら', kanji: '', definition: 'this way, here' },
      { seq: 1004500, kana: 'こっち', kanji: '', definition: 'this side' },
    ]);
  });

  it('rejects a wrong header and a bad row', () => {
    expect(() => parseJlpt('a,b\n1,2')).toThrow(/header/);
    expect(() => parseJlpt('jmdict_seq,kana,kanji,waller_definition\nx,あ,,')).toThrow(/bad row/);
  });
});
