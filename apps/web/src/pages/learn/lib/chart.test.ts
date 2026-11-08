import { describe, it, expect } from 'vitest';
import type { LearnEntry, LearnKanaKey, RecallAnswer } from '@nekotype/shared/types';
import { cellInfos, initialLearnState, keyOf } from '@/entities/learn';
import type { KanaCellInfo } from '@/entities/learn';
import { chartModel, kanaDetails, kanaStateLines } from './chart';

const NOW = new Date(2026, 4, 10, 12).getTime();
const DAY = new Date(2026, 4, 11).getTime();
const answers = (n: number, ms = 1000): RecallAnswer[] =>
  Array.from({ length: n }, (_, i) => ({ at: i, ms, ok: true }));
const entry = (box: LearnEntry['box'], dueAt: number): LearnEntry => ({ box, dueAt, updatedAt: 1 });

const a = keyOf('hiragana', 'あ');
const i = keyOf('hiragana', 'い');
const u = keyOf('hiragana', 'う');
const e = keyOf('hiragana', 'え');

function cellOf(key: LearnKanaKey): KanaCellInfo {
  const found = infos().get(key);
  if (found === undefined) throw new Error(`no cell ${key}`);
  return found;
}

function infos() {
  const base = initialLearnState();
  return cellInfos(
    'hiragana',
    {
      ...base,
      entries: { [a]: entry(2, DAY), [i]: entry(1, NOW - 1), [u]: entry(0, 0) },
      recent: { [a]: answers(10), [i]: answers(10, 900), [u]: answers(6, 2000) },
      stats: { [a]: { recognitions: 18, recognitionErrors: 4, mixups: { [i]: 4, [e]: 2 } } },
    },
    1500,
    NOW,
  );
}

describe('kanaStateLines', () => {
  it('gives the kana and romaji, the state with the next review, the median and accuracy', () => {
    expect(kanaStateLines(cellOf(a))).toEqual([
      'あ · a',
      expect.stringMatching(/^confident · next review: .+/),
      'median 1000 ms · accuracy 100%',
    ]);
  });
  it('marks a due kana', () => {
    expect(kanaStateLines(cellOf(i))[1]).toBe('confident · review due');
  });
  it('adds the number of answers while there are fewer than 10', () => {
    expect(kanaStateLines(cellOf(u))).toEqual([
      'う · u',
      'learning',
      'median 2000 ms · accuracy 100% · 6 of 10 answers',
    ]);
  });
  it('says a kana is not introduced', () => {
    expect(kanaStateLines(cellOf(e))).toEqual(['え · e', 'learning', 'not introduced yet']);
  });
  it('gives a locked kana no romaji, and names the one that opens next', () => {
    expect(kanaStateLines(cellOf(keyOf('hiragana', 'か')))).toEqual(['か', 'locked · opens next']);
    expect(kanaStateLines(cellOf(keyOf('hiragana', 'き')))).toEqual(['き', 'locked']);
  });
});

describe('kanaDetails', () => {
  it('lists the mixups, most first, and the recognition accuracy', () => {
    expect(kanaDetails(cellOf(a))).toEqual([
      'mixed up with い ×4, え ×2',
      'recognition accuracy 78% (14 of 18)',
    ]);
  });
  it('says so when there is nothing yet', () => {
    expect(kanaDetails(cellOf(i))).toEqual(['no mixups yet', 'no recognition answers yet']);
  });
});

describe('chartModel', () => {
  it('makes the aria-label from the lines and names the vowel row', () => {
    const rows = chartModel('hiragana', infos());
    expect(rows[0]?.label).toBe('vowels');
    const cell = rows[0]?.cells[1];
    expect(cell?.label).toBe(cell?.lines.join(', '));
    expect(cell?.due).toBe(true);
    expect(rows.find((row) => row.id === 'y')?.cells[1]).toBeNull();
  });
});
