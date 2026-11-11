import { beforeAll, describe, expect, it } from 'vitest';
import { readJlpt } from './jlpt';
import { parseJmdict } from './jmdict/parse';
import type { JmdictEntry } from './jmdict/parse';
import { buildWords, russianCoverage, scriptOf, selectFallback } from './words';
import type { WordRow } from './words';

const dir = new URL('../fixtures/', import.meta.url).pathname;
let entries: Map<number, JmdictEntry>;
let rows: WordRow[];

beforeAll(async () => {
  entries = await parseJmdict(`${dir}jmdict-sample.xml`, null);
  rows = readJlpt(`${dir}jlpt-sample.csv`).map(({ seq, kana }) => ({ seq, kana }));
});

describe('scriptOf', () => {
  it('classifies pure scripts, counting ー as either', () => {
    expect(scriptOf('あう')).toBe('hiragana');
    expect(scriptOf('コーヒー')).toBe('katakana');
    expect(scriptOf('らーめん')).toBe('hiragana');
    expect(scriptOf('ー')).toBeNull();
    expect(scriptOf('1にち')).toBeNull();
    expect(scriptOf('あカ')).toBeNull();
  });
});

describe('buildWords', () => {
  it('selects words, merges homonyms and reports exclusions', () => {
    const { items, report } = buildWords(rows, entries, 'jlpt');
    expect(items.hiragana.map((i) => i.id)).toEqual([
      'w:hiragana:あう',
      'w:hiragana:こちら',
      'w:hiragana:こっち',
      'w:hiragana:はし',
      'w:hiragana:いちにちじゅう',
    ]);
    expect(items.katakana.map((i) => i.id)).toEqual([
      'w:katakana:コーヒー',
      'w:katakana:アルバイト',
    ]);
    expect(report.excluded).toEqual({
      readingNotInEntry: 2, // a missing entry and a search-only reading
      mixedScript: 1,
      duplicate: 1,
    });
    expect(report.selected).toBe(7);
    expect(report.compileFailed).toEqual([]);
  });

  it('uses the first gloss of the first three senses that have an English gloss', () => {
    const { items } = buildWords(rows, entries, 'jlpt');
    // Senses: "to meet", "to see", (Russian only: skipped), "to have an accident".
    expect(items.hiragana[0]?.meaning.en).toBe('to meet; to see; to have an accident');
  });

  it('applies stagr: a sense counts for the listed readings only', () => {
    const { items } = buildWords(rows, entries, 'jlpt');
    const byId = new Map(items.hiragana.map((i) => [i.id, i.meaning.en]));
    expect(byId.get('w:hiragana:こちら')).toBe('this way; this person');
    expect(byId.get('w:hiragana:こっち')).toBe('this way; this side');
  });

  it('merges homonyms in item order, first sense of up to three entries', () => {
    const { items } = buildWords(rows, entries, 'jlpt');
    expect(items.hiragana.find((i) => i.id === 'w:hiragana:はし')?.meaning.en).toBe(
      'bridge; chopsticks; edge',
    );
  });

  it('drops senses from the end while the meaning is over 60 characters', () => {
    const { items } = buildWords(rows, entries, 'jlpt');
    // The first gloss alone is 68 characters and stays; the others are dropped.
    const long = items.hiragana.find((i) => i.id === 'w:hiragana:いちにちじゅう');
    expect(long?.meaning.en).toBe(
      'all day long, throughout the whole day, from morning till night',
    );
    const two = buildWords([{ seq: 1000003, kana: 'はし' }], entries, 'jlpt');
    expect(two.items.hiragana[0]?.meaning.en).toBe('bridge');
  });

  it('lists compile failures and removes them from the items', () => {
    // ゝ is hiragana-only text the engine cannot compile.
    const odd = new Map(entries);
    odd.set(1000009, {
      seq: 1000009,
      readings: [{ text: 'ゝ', searchOnly: false, pri: [] }],
      kanji: [],
      senses: [{ glossEn: ['x'], glossRu: [] }],
    });
    const result = buildWords([{ seq: 1000009, kana: 'ゝ' }], odd, 'jlpt');
    expect(result.report.selected).toBe(1);
    expect(result.report.compileFailed).toEqual([{ id: 'w:hiragana:ゝ', text: 'ゝ' }]);
    expect(result.items.hiragana).toEqual([]);
  });

  it('reports Russian coverage per kept item', () => {
    const { russian } = buildWords(rows, entries, 'jlpt');
    expect(russian['w:hiragana:あう']).toBe(true);
    expect(russian['w:hiragana:こちら']).toBe(false);
    expect(russian['w:hiragana:はし']).toBe(true);
    const coverage = russianCoverage(russian);
    expect(coverage.total).toBe(7);
    expect(coverage.withRussian).toBe(2);
    expect(coverage.percent).toBe(28.6);
  });
});

describe('selectFallback', () => {
  it('orders nfXX ranks first, then by tag count and sequence number', () => {
    const result = selectFallback(entries.values());
    // 1000001 has nf26 and 1000003 has nf10: by rank. Then 1000004 (2 tags), then the single-tag
    // entries by seq: 1000006 (gai1, katakana) and 1000007 (news1). 1000002 has ichi1 on the
    // first reading; 1000008 has news2 only and 1000005 no tag: both excluded.
    expect(result).toEqual([
      { seq: 1000003, kana: 'はし' },
      { seq: 1000001, kana: 'あう' },
      { seq: 1000004, kana: 'はし' },
      { seq: 1000002, kana: 'こちら' },
      { seq: 1000006, kana: 'コーヒー' },
      { seq: 1000007, kana: 'いちにちじゅう' },
    ]);
  });

  it('caps the result', () => {
    expect(selectFallback(entries.values(), 2)).toHaveLength(2);
  });
});
