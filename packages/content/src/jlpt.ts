import { readFileSync } from 'node:fs';

export interface JlptRow {
  seq: number;
  kana: string;
  kanji: string;
  definition: string;
}

/** RFC 4180: quoted fields, `""` as an escaped quote, commas and newlines inside quotes. */
export function parseCsv(text: string): string[][] {
  const rows: string[][] = [];
  let row: string[] = [];
  let field = '';
  let quoted = false;
  for (let i = 0; i < text.length; i++) {
    const ch = text.charAt(i);
    if (quoted) {
      if (ch !== '"') field += ch;
      else if (text.charAt(i + 1) === '"') {
        field += '"';
        i += 1;
      } else quoted = false;
    } else if (ch === '"') {
      quoted = true;
    } else if (ch === ',') {
      row.push(field);
      field = '';
    } else if (ch === '\n' || ch === '\r') {
      if (ch === '\r' && text.charAt(i + 1) === '\n') i += 1;
      row.push(field);
      rows.push(row);
      row = [];
      field = '';
    } else field += ch;
  }
  if (quoted) throw new Error('CSV: unterminated quoted field');
  if (field !== '' || row.length > 0) {
    row.push(field);
    rows.push(row);
  }
  return rows;
}

const HEADER = ['jmdict_seq', 'kana', 'kanji', 'waller_definition'];

/** The rows of one JLPT CSV, in file order. */
export function parseJlpt(text: string): JlptRow[] {
  const [header, ...rows] = parseCsv(text);
  if (header === undefined || HEADER.some((name, i) => header[i] !== name)) {
    throw new Error(`JLPT CSV: unexpected header ${JSON.stringify(header)}`);
  }
  return rows.map((row, i) => {
    const [seq, kana, kanji, definition] = row;
    const number = Number(seq);
    if (!Number.isInteger(number) || kana === undefined || kana === '') {
      throw new Error(`JLPT CSV: bad row ${i + 2}: ${JSON.stringify(row)}`);
    }
    return { seq: number, kana, kanji: kanji ?? '', definition: definition ?? '' };
  });
}

export function readJlpt(path: string): JlptRow[] {
  return parseJlpt(readFileSync(path, 'utf8'));
}
