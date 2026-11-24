import { describe, it, expect } from 'vitest';
import type { LearnKanaKey } from '@nekotype/shared/types';
import { loadDictionaryPart } from '@/shared/i18n';
import { cellInfos, keyOf } from '@/entities/learn';
import type { KanaCellInfo } from '@/entities/learn';
import { chartBlockLabels, chartLegend, chartModel, kanaStateLines } from './chart';
import { answer, intro, learnedEvents, viewOfEvents } from './test-util';

// The chart's strings are the `progress` part of the dictionary, loaded with the route.
await loadDictionaryPart('progress');

const START = new Date(2026, 4, 1, 12).getTime();
const a = keyOf('hiragana', 'あ');
const i = keyOf('hiragana', 'い');
const u = keyOf('hiragana', 'う');
const e = keyOf('hiragana', 'え');

// あ: learned, ten fast recalls, five recognitions with three errors (い twice, え once);
// い: learned; う: introduced with three slow recalls; え: introduced and not answered.
const view = viewOfEvents([
  intro(a, { at: START }),
  ...[i, i, e, a, a].map((wrong, n) =>
    answer(a, {
      at: START + 1000 + n * 1000,
      task: 'recognition',
      ok: wrong === a,
      wrong: wrong === a ? null : wrong,
    }),
  ),
  ...Array.from({ length: 10 }, (_, n) =>
    answer(a, { at: START + 100_000 + n * 40_000, ms: n < 5 ? 1000 : 800 }),
  ),
  ...learnedEvents('い', START + 900_000),
  intro(u, { at: START + 1_200_000 }),
  ...Array.from({ length: 3 }, (_, n) =>
    answer(u, { at: START + 1_200_100 + n * 40_000, ms: 2000 }),
  ),
  intro(e, { at: START + 1_800_000 }),
]);

/** A moment before `a` is due, and one after `i` is. */
const BEFORE = (view.kana.get(a)?.dueFrom ?? 0) - 1;
const AFTER = (view.kana.get(i)?.dueFrom ?? 0) + 1;

function cellOf(key: LearnKanaKey, now = AFTER): KanaCellInfo {
  const found = cellInfos('hiragana', view, now).get(key);
  if (found === undefined) throw new Error(`no cell ${key}`);
  return found;
}

describe('kanaStateLines', () => {
  it('gives the kana and romaji, the state with the next review, the median and accuracy', () => {
    expect(kanaStateLines(cellOf(a, BEFORE))).toEqual([
      'あ · a',
      expect.stringMatching(/^learned · next review: .+/),
      'median 900 ms · accuracy 100%',
    ]);
  });
  it('marks a due kana', () => {
    expect(kanaStateLines(cellOf(i))[1]).toBe('learned · review due');
  });
  it('adds the number of answers while there are fewer than 10', () => {
    expect(kanaStateLines(cellOf(u))).toEqual([
      'う · u',
      'learning',
      'median 2000 ms · accuracy 100% · 3 of 10 answers',
    ]);
  });
  it('shows no median for an introduced kana with no recall answer yet', () => {
    expect(kanaStateLines(cellOf(e))).toEqual(['え · e', 'learning']);
  });
  it('gives a locked kana no romaji, and names the one that opens next', () => {
    expect(kanaStateLines(cellOf(keyOf('hiragana', 'お')))).toEqual(['お', 'locked · opens next']);
    expect(kanaStateLines(cellOf(keyOf('hiragana', 'き')))).toEqual(['き', 'locked']);
  });
});

describe('chart captions and legend', () => {
  it("names every block and every state, and draws the swatches with the track's kana", () => {
    expect(chartBlockLabels()).toEqual({
      basic: 'basic',
      dakuten: 'voiced',
      yoon: 'combinations',
      extended: 'extended',
    });
    expect(chartLegend('katakana')).toEqual({
      sample: 'ア',
      labels: {
        locked: 'locked',
        learning: 'learning',
        learned: 'learned',
        mastered: 'mastered',
        due: 'review due',
      },
    });
  });
});

describe('chartModel', () => {
  it('makes the aria-label from the lines and names the vowel row', () => {
    const rows = chartModel('hiragana', cellInfos('hiragana', view, AFTER));
    expect(rows[0]?.label).toBe('vowels');
    const cell = rows[0]?.cells[1];
    expect(cell?.label).toBe(cell?.lines.join(', '));
    expect(cell?.due).toBe(true);
    expect(rows.find((row) => row.id === 'y')?.cells[1]).toBeNull();
  });
});
