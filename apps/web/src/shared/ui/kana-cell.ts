import type { ChartCellState } from './kana-chart';

/** The class of a cell's state: `learned` has the fill the old `confident` had (ADR 104). */
export function cellStateClass(state: ChartCellState): string {
  return state === 'learned' ? 'is-st-learned' : `is-${state}`;
}
