import { describe, it, expect } from 'vitest';
import { foldLog, nextRow } from '@nekotype/model';
import { intro } from '@nekotype/model/testing';
import { learnedEvents, viewOfEvents } from './test-view';
import { pathOf } from './path';
import { keyOf } from './tracks';

const NOW = 1_700_000_000_000;
const hira = (kana: string) => keyOf('hiragana', kana);

describe('pathOf', () => {
  it('blocks follow the categories: four for katakana, three for hiragana', () => {
    const view = viewOfEvents([]);
    expect(pathOf(view, 'hiragana').blocks.map((b) => b.category)).toEqual([
      'basic',
      'dakuten',
      'yoon',
    ]);
    expect(pathOf(view, 'katakana').blocks.map((b) => b.category)).toEqual([
      'basic',
      'dakuten',
      'yoon',
      'extended',
    ]);
    expect(pathOf(view, 'hiragana').blocks.reduce((n, b) => n + b.total, 0)).toBe(104);
    expect(pathOf(view, 'katakana').blocks.reduce((n, b) => n + b.total, 0)).toBe(125);
  });

  it('a fresh track has the vowels as the current row and everything else locked', () => {
    const path = pathOf(viewOfEvents([]), 'hiragana');
    expect(path.current).toBe('hiragana:vowels');
    const rows = path.blocks.flatMap((b) => b.rows);
    expect(rows[0]?.state).toBe('current');
    expect(rows.slice(1).every((r) => r.state === 'locked')).toBe(true);
    expect(path.blocks.map((b) => b.state)).toEqual(['current', 'locked', 'locked']);
    expect(rows[0]).toMatchObject({ head: '', introduced: 0, learned: 0, total: 5 });
  });

  it('a row is done when every kana is introduced, not when it is learned', () => {
    const vowels = ['あ', 'い', 'う', 'え'].map(hira);
    const events = [
      ...vowels.map((key, i) => intro(key, { at: NOW + i })),
      intro(hira('お'), { at: NOW + 9 }),
    ];
    const path = pathOf(viewOfEvents(events), 'hiragana');
    const [vowelRow, kRow] = path.blocks.flatMap((b) => b.rows);
    expect(vowelRow).toMatchObject({ state: 'done', introduced: 5, learned: 0 });
    expect(kRow?.state).toBe('current');
    expect(path.current).toBe('hiragana:k');
  });

  it('counts learned kana apart from introduced ones', () => {
    const events = [...learnedEvents(hira('あ'), NOW), intro(hira('い'), { at: NOW + 1e6 })];
    const row = pathOf(viewOfEvents(events), 'hiragana').blocks[0]?.rows[0];
    expect(row).toMatchObject({ introduced: 2, learned: 1, total: 5, state: 'current' });
  });

  it('a block is done once all its rows are', () => {
    const basic = pathOf(viewOfEvents([]), 'hiragana').blocks[0]?.rows.flatMap((r) => r.keys) ?? [];
    const path = pathOf(
      viewOfEvents(basic.map((key, i) => intro(key, { at: NOW + i }))),
      'hiragana',
    );
    expect(path.blocks.map((b) => b.state)).toEqual(['done', 'current', 'locked']);
    expect(path.current).toBe('hiragana:g');
    expect(path.blocks[0]?.introduced).toBe(path.blocks[0]?.total);
  });

  it('a dakuten kana introduced out of order keeps its row locked and still counts', () => {
    const events = [intro(hira('あ'), { at: NOW }), intro(hira('が'), { at: NOW + 1 })];
    const rows = pathOf(viewOfEvents(events), 'hiragana').blocks.flatMap((b) => b.rows);
    const g = rows.find((r) => r.id === 'hiragana:g');
    expect(g).toMatchObject({ state: 'locked', introduced: 1 });
  });

  it('the current row is the one the model forecasts: it agrees with nextRow', () => {
    for (const track of ['hiragana', 'katakana'] as const) {
      const keys = pathOf(viewOfEvents([]), track).blocks.flatMap((b) =>
        b.rows.flatMap((r) => r.keys),
      );
      for (let count = 0; count <= keys.length; count += 7) {
        const events = keys.slice(0, count).map((key, i) => intro(key, { at: NOW + i }));
        const numbered = events.map((event, i) => ({ ...event, dev: 'd1', n: i + 1 }));
        const state = foldLog(numbered, { targetMs: 1500, stats: false }).snapshot().state;
        expect(pathOf(viewOfEvents(events), track).current).toBe(nextRow(state, track));
      }
    }
  });
});
