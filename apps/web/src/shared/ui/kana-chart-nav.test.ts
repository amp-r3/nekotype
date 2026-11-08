import { describe, it, expect } from 'vitest';
import { moveInGrid } from './kana-chart-nav';

const T = true;
const F = false;
// vowels / y with gaps / a short row
const rows = [
  [T, T, T, T, T],
  [T, F, T, F, T],
  [T, T, T],
];

describe('moveInGrid', () => {
  it('walks the cells in reading order and stops at the ends', () => {
    expect(moveInGrid(rows, { row: 0, slot: 4 }, 'right')).toEqual({ row: 1, slot: 0 });
    expect(moveInGrid(rows, { row: 1, slot: 0 }, 'right')).toEqual({ row: 1, slot: 2 });
    expect(moveInGrid(rows, { row: 1, slot: 0 }, 'left')).toEqual({ row: 0, slot: 4 });
    expect(moveInGrid(rows, { row: 0, slot: 0 }, 'left')).toEqual({ row: 0, slot: 0 });
    expect(moveInGrid(rows, { row: 2, slot: 2 }, 'right')).toEqual({ row: 2, slot: 2 });
  });
  it('goes to the nearest column of the adjacent row, the lower one on a tie', () => {
    expect(moveInGrid(rows, { row: 0, slot: 1 }, 'down')).toEqual({ row: 1, slot: 0 });
    expect(moveInGrid(rows, { row: 0, slot: 3 }, 'down')).toEqual({ row: 1, slot: 2 });
    expect(moveInGrid(rows, { row: 1, slot: 4 }, 'down')).toEqual({ row: 2, slot: 2 });
    expect(moveInGrid(rows, { row: 2, slot: 1 }, 'up')).toEqual({ row: 1, slot: 0 });
  });
  it('stays at the top and bottom edges', () => {
    expect(moveInGrid(rows, { row: 0, slot: 2 }, 'up')).toEqual({ row: 0, slot: 2 });
    expect(moveInGrid(rows, { row: 2, slot: 0 }, 'down')).toEqual({ row: 2, slot: 0 });
  });
  it('skips a row with no cells', () => {
    expect(moveInGrid([[T], [F, F], [F, T]], { row: 0, slot: 0 }, 'down')).toEqual({
      row: 2,
      slot: 1,
    });
  });
});
