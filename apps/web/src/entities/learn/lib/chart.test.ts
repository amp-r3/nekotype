import { describe, it, expect } from 'vitest';
import { answer, intro, learnedEvents, viewOfEvents } from './test-view';
import { cellInfos, chartRows } from './chart';
import { keyOf } from './tracks';

const NOW = 1_700_000_000_000;
const a = keyOf('hiragana', 'あ');
const i = keyOf('hiragana', 'い');
const u = keyOf('hiragana', 'う');
const e = keyOf('hiragana', 'え');

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
  it('are locked, learning, learned and mastered, from the fold of the log', () => {
    const view = viewOfEvents([
      ...learnedEvents(a, NOW - 40 * 86_400_000),
      ...learnedEvents(i, NOW - 60_000),
      intro(u, { at: NOW - 30_000 }),
      answer(u, { at: NOW - 20_000 }),
    ]);
    const cells = cellInfos('hiragana', view, NOW);
    expect(cells.get(i)).toMatchObject({ state: 'learned', introduced: true });
    expect(cells.get(u)).toMatchObject({ state: 'learning', introduced: true, answers: 1 });
    expect(cells.get(e)).toMatchObject({ state: 'locked', introduced: false, dueAt: null });
    expect(cells.get(a)?.dueAt).not.toBeNull();
  });

  it('mark a learned kana due when its review falls within the gap, never a learning one', () => {
    const day = 86_400_000;
    const spaced = [3, 8, 20].map((days) => answer(a, { at: NOW - 40 * day + days * day }));
    const view = viewOfEvents([
      ...learnedEvents(a, NOW - 40 * day),
      ...spaced,
      intro(u, { at: NOW - 20_000 }),
    ]);
    const cells = cellInfos('hiragana', view, NOW);
    expect(cells.get(a)?.dueAt).not.toBeNull();
    expect(cells.get(u)).toMatchObject({ state: 'learning', due: false });
    const due = cells.get(a)?.dueAt ?? 0;
    expect(cellInfos('hiragana', view, due + 1).get(a)).toMatchObject({ due: true });
    const from = view.kana.get(a)?.dueFrom ?? 0;
    expect(cellInfos('hiragana', view, from - 1).get(a)?.due).toBe(false);
  });

  it('name the locked kana that opens next', () => {
    const none = viewOfEvents([]);
    expect(
      [...cellInfos('hiragana', none, NOW).values()]
        .filter((cell) => cell.opensNext)
        .map((cell) => cell.kana),
    ).toEqual(['あ']);
    const learned = viewOfEvents(
      ['あ', 'い', 'う', 'え', 'お'].flatMap((kana, at) =>
        learnedEvents(keyOf('hiragana', kana), NOW - 10_000_000 + at * 1_000_000),
      ),
    );
    expect(
      [...cellInfos('hiragana', learned, NOW).values()]
        .filter((cell) => cell.opensNext)
        .map((cell) => cell.kana),
    ).toEqual(['か']);
  });

  it('list the confusions, most first, with the recognition inputs', () => {
    const view = viewOfEvents([
      intro(a, { at: NOW }),
      answer(a, { at: NOW + 1, task: 'recognition', ok: false, wrong: u }),
      answer(a, { at: NOW + 2, task: 'recognition', ok: false, wrong: u }),
      answer(a, { at: NOW + 3, task: 'recognition', ok: false, wrong: i }),
      answer(a, { at: NOW + 4, task: 'recognition' }),
    ]);
    const cell = cellInfos('hiragana', view, NOW).get(a);
    expect(cell?.confusions).toEqual([
      { key: u, count: 2 },
      { key: i, count: 1 },
    ]);
    expect(cell).toMatchObject({ recognitions: 4, recognitionErrors: 3 });
  });
});
