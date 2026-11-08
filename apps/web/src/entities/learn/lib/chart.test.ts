import { describe, it, expect } from 'vitest';
import type { LearnBox, LearnEntry, LearnState, RecallAnswer } from '@nekotype/shared/types';
import { cellInfos, chartRows } from './chart';
import { initialLearnState } from './state';
import { keyOf } from './tracks';

const NOW = 1_000_000_000_000;
const TARGET = 1500;
const answers = (ms: number, ok = true, n = 10): RecallAnswer[] =>
  Array.from({ length: n }, (_, i) => ({ at: i, ms, ok }));

const entry = (box: LearnBox, dueAt: number): LearnEntry => ({ box, dueAt, updatedAt: 1 });

function stateWith(patch: Partial<LearnState>): LearnState {
  return { ...initialLearnState(), ...patch };
}

describe('chart rows', () => {
  it('cover every kana of a track once', () => {
    for (const [track, total] of [
      ['hiragana', 104],
      ['katakana', 125],
    ] as const) {
      const kana = chartRows(track).flatMap((row) => row.kana.filter((k) => k !== null));
      expect(kana).toHaveLength(total);
      expect(new Set(kana).size).toBe(total);
    }
  });
  it('line up the vowels: the row of や ゆ よ has gaps, the vowel row has no head', () => {
    const rows = chartRows('hiragana');
    expect(rows[0]?.head).toBe('');
    expect(rows[0]?.kana).toEqual(['あ', 'い', 'う', 'え', 'お']);
    expect(rows.find((row) => row.id === 'y')?.kana).toEqual(['や', null, 'ゆ', null, 'よ']);
  });
});

describe('cell states', () => {
  const a = keyOf('hiragana', 'あ');
  const i = keyOf('hiragana', 'い');
  const u = keyOf('hiragana', 'う');
  const e = keyOf('hiragana', 'え');

  it('are locked, learning, confident and mastered, with the due mark over the last two', () => {
    const state = stateWith({
      entries: {
        [a]: entry(4, NOW - 1),
        [i]: entry(2, NOW + 1),
        [u]: entry(1, NOW - 5),
        [e]: entry(0, 0),
      },
      recent: {
        [a]: answers(900),
        [i]: answers(900),
        [u]: answers(2000),
        [e]: answers(900, true, 4),
      },
    });
    const cells = cellInfos('hiragana', state, TARGET, NOW);
    expect(cells.get(a)).toMatchObject({ state: 'mastered', due: true });
    expect(cells.get(i)).toMatchObject({ state: 'confident', due: false, dueAt: NOW + 1 });
    // Slow: not confident, so learning, and a learning kana carries no due mark.
    expect(cells.get(u)).toMatchObject({ state: 'learning', due: false });
    expect(cells.get(e)).toMatchObject({
      state: 'learning',
      introduced: true,
      dueAt: null,
      answers: 4,
    });
    expect(cells.get(keyOf('hiragana', 'お'))).toMatchObject({ introduced: false });
    expect(cells.get(keyOf('hiragana', 'か'))).toMatchObject({ state: 'locked', opensNext: true });
    expect(cells.get(keyOf('hiragana', 'き'))).toMatchObject({ state: 'locked', opensNext: false });
  });

  it('show a kana of box 4 that lost its confidence as learning', () => {
    const state = stateWith({
      entries: { [a]: entry(5, NOW - 1) },
      recent: { [a]: answers(900, false) },
    });
    expect(cellInfos('hiragana', state, TARGET, NOW).get(a)).toMatchObject({
      state: 'learning',
      due: false,
    });
  });

  it('follow the target answer time at once', () => {
    const state = stateWith({
      entries: { [i]: entry(1, NOW + 1) },
      recent: { [i]: answers(1800) },
    });
    expect(cellInfos('hiragana', state, 1500, NOW).get(i)?.state).toBe('learning');
    expect(cellInfos('hiragana', state, 2000, NOW).get(i)?.state).toBe('confident');
  });

  it('name the kana that opens next after the unlock order, ヴ before ヴァ', () => {
    const state = stateWith({});
    const katakana = cellInfos('katakana', state, TARGET, NOW);
    expect(
      [...katakana.values()].filter((cell) => cell.opensNext).map((cell) => cell.kana),
    ).toEqual(['カ']);
  });

  it('list the mixups, most first, with the recognition accuracy inputs', () => {
    const state = stateWith({
      stats: {
        [a]: {
          recognitions: 18,
          recognitionErrors: 4,
          mixups: { [i]: 2, [u]: 4, [e]: 0 },
        },
      },
    });
    const cell = cellInfos('hiragana', state, TARGET, NOW).get(a);
    expect(cell?.mixups).toEqual([
      { key: u, count: 4 },
      { key: i, count: 2 },
    ]);
    expect(cell).toMatchObject({ recognitions: 18, recognitionErrors: 4 });
  });
});
