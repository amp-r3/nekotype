import { describe, it, expect } from 'vitest';
import type { PhraseCredit } from '@/entities/prompt';
import { PAGE_SIZE, clampPage, pageCount, slicePage, sortCredits } from './paging';

function credit(id: number): PhraseCredit {
  return {
    id: `p:${String(id)}`,
    text: 'あ',
    sentence: { id, author: 'a' },
    translation: { id: id + 1, author: 'b' },
    transcriptionAuthor: null,
  };
}

const rows = Array.from({ length: 62 }, (_, i) => i + 1);

describe('phrase credits paging', () => {
  it('shows 25 rows a page', () => {
    expect(PAGE_SIZE).toBe(25);
    const first = slicePage(rows, 1);
    expect(first.rows).toHaveLength(25);
    expect([first.from, first.to]).toEqual([1, 25]);
    const second = slicePage(rows, 2);
    expect([second.from, second.to]).toEqual([26, 50]);
  });

  it('gives the last page its partial rows', () => {
    const last = slicePage(rows, 3);
    expect(last.rows).toHaveLength(12);
    expect([last.from, last.to]).toEqual([51, 62]);
    expect(pageCount(62)).toBe(3);
    expect(pageCount(50)).toBe(2);
  });

  it('clamps an out-of-range page', () => {
    expect(slicePage(rows, 0).page).toBe(1);
    expect(slicePage(rows, 99).page).toBe(3);
    expect(clampPage(-4, 62)).toBe(1);
  });

  it('handles an empty list', () => {
    const empty = slicePage([], 1);
    expect(empty).toEqual({ page: 1, rows: [], from: 0, to: 0 });
    expect(pageCount(0)).toBe(1);
  });

  it('sorts by sentence id ascending without changing the input', () => {
    const input = [credit(30), credit(4), credit(12)];
    expect(sortCredits(input).map((c) => c.sentence.id)).toEqual([4, 12, 30]);
    expect(input.map((c) => c.sentence.id)).toEqual([30, 4, 12]);
  });
});
