import type { ComponentChildren, JSX } from 'preact';
import { useRef, useState } from 'preact/hooks';
import { cx } from '../lib';
import { moveInGrid } from './kana-chart-nav';
import type { GridKey } from './kana-chart-nav';

export type ChartCellState = 'locked' | 'learning' | 'confident' | 'mastered';

export type ChartCell = {
  // Unique in the chart.
  readonly id: string;
  readonly kana: string;
  readonly state: ChartCellState;
  // Review due: a mark over a confident or mastered kana.
  readonly due: boolean;
  // The tooltip; the same lines are in `label`.
  readonly lines: readonly string[];
  readonly label: string;
};

export type ChartRow = {
  readonly id: string;
  // The consonant in the head column; empty for the vowels, whose column stays blank.
  readonly head: string;
  // The accessible name of the row.
  readonly label: string;
  // Rows of one block sit together; a new block starts after a gap.
  readonly block: string;
  // One slot per column; `null` is a gap.
  readonly cells: readonly (ChartCell | null)[];
};

export type KanaChartProps = {
  readonly rows: readonly ChartRow[];
  readonly ariaLabel: string;
  // Details under the row of an activated cell; without it cells do not open.
  readonly renderDetails?: (cell: ChartCell, close: () => void) => ComponentChildren;
};

const ARROWS: Readonly<Record<string, GridKey>> = {
  ArrowLeft: 'left',
  ArrowRight: 'right',
  ArrowUp: 'up',
  ArrowDown: 'down',
};

/**
 * The kana table of a track: a grid of buttons with one tab stop. It draws what it is given and
 * knows nothing of learning; the states and the strings come from the caller.
 */
export function KanaChart({ rows, ariaLabel, renderDetails }: KanaChartProps): JSX.Element {
  const first = rows.flatMap((row) => row.cells).find((cell) => cell !== null);
  const [stop, setStop] = useState<string | undefined>(first?.id);
  const [hover, setHover] = useState<string | null>(null);
  const [focused, setFocused] = useState<string | null>(null);
  const [open, setOpen] = useState<string | null>(null);
  const buttons = useRef(new Map<string, HTMLButtonElement>());

  const present = rows.map((row) => row.cells.map((cell) => cell !== null));
  const tip = hover ?? focused;
  // The stop moves to the first cell if the cell it was on is gone (another track).
  const known = rows.some((row) => row.cells.some((cell) => cell?.id === stop));
  const tabStop = known ? stop : first?.id;

  function focusCell(id: string): void {
    setStop(id);
    buttons.current.get(id)?.focus();
  }

  function onKeyDown(event: KeyboardEvent, rowAt: number, slot: number, cell: ChartCell): void {
    if (event.key === 'Escape' && open !== null) {
      event.preventDefault();
      setOpen(null);
      focusCell(open);
      return;
    }
    const key = ARROWS[event.key];
    if (key === undefined) return;
    event.preventDefault();
    const to = moveInGrid(present, { row: rowAt, slot }, key);
    const target = rows[to.row]?.cells[to.slot];
    if (target !== null && target !== undefined && target.id !== cell.id) focusCell(target.id);
  }

  function activate(cell: ChartCell): void {
    if (renderDetails === undefined || cell.state === 'locked') return;
    setOpen(open === cell.id ? null : cell.id);
  }

  return (
    <div role="grid" aria-label={ariaLabel} className="nk-chart" data-testid="kana-chart">
      {rows.map((row, rowAt) => {
        const openCell = row.cells.find((cell) => cell !== null && cell.id === open);
        const startsBlock = rowAt > 0 && rows[rowAt - 1]?.block !== row.block;
        return (
          <div key={row.id} className={cx('nk-chart__group', startsBlock && 'is-block-start')}>
            <div role="row" className="nk-chart__row">
              <div role="rowheader" aria-label={row.label} className="nk-chart__head">
                <span aria-hidden="true">{row.head}</span>
              </div>
              {row.cells.map((cell, slot) =>
                cell === null ? (
                  <div key={`gap-${slot}`} role="gridcell" aria-hidden="true" className="nk-cell" />
                ) : (
                  <div key={cell.id} role="gridcell" className="nk-chart__slot">
                    <button
                      type="button"
                      ref={(el) => {
                        if (el === null) buttons.current.delete(cell.id);
                        else buttons.current.set(cell.id, el);
                      }}
                      className={cx(
                        'nk-cell font-jp',
                        `is-${cell.state}`,
                        cell.due && 'is-due',
                        Array.from(cell.kana).length > 1 ? 'text-jp-cell-sm' : 'text-jp-cell',
                      )}
                      lang="ja"
                      tabIndex={cell.id === tabStop ? 0 : -1}
                      aria-label={cell.label}
                      aria-disabled={cell.state === 'locked' ? true : undefined}
                      aria-expanded={
                        renderDetails !== undefined && cell.state !== 'locked'
                          ? open === cell.id
                          : undefined
                      }
                      data-testid="kana-cell"
                      data-kana={cell.kana}
                      data-state={cell.state}
                      data-due={cell.due ? 'true' : undefined}
                      onClick={() => {
                        setStop(cell.id);
                        activate(cell);
                      }}
                      onKeyDown={(event) => {
                        onKeyDown(event, rowAt, slot, cell);
                      }}
                      onFocus={() => {
                        setStop(cell.id);
                        setFocused(cell.id);
                      }}
                      onBlur={() => {
                        setFocused((current) => (current === cell.id ? null : current));
                      }}
                      onMouseEnter={() => {
                        setHover(cell.id);
                      }}
                      onMouseLeave={() => {
                        setHover((current) => (current === cell.id ? null : current));
                      }}
                    >
                      {cell.kana}
                    </button>
                    {tip === cell.id && (
                      <span aria-hidden="true" className="nk-chart__tip" data-testid="kana-tooltip">
                        {cell.lines.map((line, at) => (
                          <span key={at} className="block">
                            {line}
                          </span>
                        ))}
                      </span>
                    )}
                  </div>
                ),
              )}
            </div>
            {openCell !== undefined && openCell !== null && renderDetails !== undefined && (
              <div role="row">
                <div role="gridcell" className="nk-chart__details" data-testid="kana-details">
                  {renderDetails(openCell, () => {
                    setOpen(null);
                    focusCell(openCell.id);
                  })}
                </div>
              </div>
            )}
          </div>
        );
      })}
    </div>
  );
}
