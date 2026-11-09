import type { ComponentChildren, JSX } from 'preact';
import { useRef, useState } from 'preact/hooks';
import { cx } from '../lib';
import { Button } from './button';
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
  // Rows of one block sit together under the block's caption; blocks stand side by side.
  readonly block: string;
  // One slot per column; `null` is a gap.
  readonly cells: readonly (ChartCell | null)[];
};

// The legend under the chart: the four states, then the due mark set apart from them.
export type ChartLegend = {
  // The kana drawn in the swatches.
  readonly sample: string;
  readonly labels: Readonly<Record<ChartCellState | 'due', string>>;
};

export type KanaChartProps = {
  readonly rows: readonly ChartRow[];
  readonly ariaLabel: string;
  // The caption of each block, by `ChartRow.block`.
  readonly blockLabels?: Readonly<Record<string, string>>;
  readonly legend?: ChartLegend;
  // Details under the row of an activated cell; without it cells do not open.
  readonly renderDetails?: (cell: ChartCell, close: () => void) => ComponentChildren;
};

const ARROWS: Readonly<Record<string, GridKey>> = {
  ArrowLeft: 'left',
  ArrowRight: 'right',
  ArrowUp: 'up',
  ArrowDown: 'down',
};

const LEGEND_STATES: readonly ChartCellState[] = ['locked', 'learning', 'confident', 'mastered'];

type Block = { readonly id: string; readonly rows: readonly { row: ChartRow; at: number }[] };

// Consecutive rows of one block form a group; the row index stays the one of the whole chart.
function blocksOf(rows: readonly ChartRow[]): readonly Block[] {
  const blocks: { id: string; rows: { row: ChartRow; at: number }[] }[] = [];
  rows.forEach((row, at) => {
    const last = blocks[blocks.length - 1];
    if (last !== undefined && last.id === row.block) last.rows.push({ row, at });
    else blocks.push({ id: row.block, rows: [{ row, at }] });
  });
  return blocks;
}

// `:focus-visible` is true for focus by keys, and for a call of `focus()` after keys; false after a
// click. A browser without the selector counts as keyboard focus.
function isKeyboardFocus(element: HTMLElement): boolean {
  try {
    return element.matches(':focus-visible');
  } catch {
    return true;
  }
}

/**
 * The kana table of a track: a grid of buttons with one tab stop, its blocks side by side. It draws
 * what it is given and knows nothing of learning; the states and the strings come from the caller.
 */
export function KanaChart({
  rows,
  ariaLabel,
  blockLabels,
  legend,
  renderDetails,
}: KanaChartProps): JSX.Element {
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

  function close(): void {
    if (open === null) return;
    const id = open;
    setOpen(null);
    focusCell(id);
  }

  // Esc anywhere in the chart, the open details included, closes them and returns to the cell.
  function onGridKeyDown(event: KeyboardEvent): void {
    if (event.key !== 'Escape' || open === null) return;
    event.preventDefault();
    close();
  }

  function onCellKeyDown(event: KeyboardEvent, rowAt: number, slot: number, cell: ChartCell): void {
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

  function renderRow(row: ChartRow, rowAt: number): JSX.Element {
    const openCell = row.cells.find((cell) => cell !== null && cell.id === open);
    const filled = row.cells.length;
    return (
      <div key={row.id} className="nk-chart__group">
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
                    onCellKeyDown(event, rowAt, slot, cell);
                  }}
                  onFocus={(event) => {
                    setStop(cell.id);
                    // Only keyboard focus shows the tooltip: the focus that returns to the cell
                    // after the details are closed by a click must not pin it there.
                    setFocused(isKeyboardFocus(event.currentTarget) ? cell.id : null);
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
                {/* Above the cell, so it never covers the row below or the open details. */}
                {tip === cell.id && open !== cell.id && (
                  <span
                    aria-hidden="true"
                    className={cx(
                      'nk-chart__tip',
                      slot === 0 && 'is-start',
                      slot >= filled - 1 && filled > 2 && 'is-end',
                    )}
                    data-testid="kana-tooltip"
                  >
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
              {renderDetails(openCell, close)}
            </div>
          </div>
        )}
      </div>
    );
  }

  return (
    <div className="nk-chart" data-testid="kana-chart">
      <div
        role="grid"
        aria-label={ariaLabel}
        className="nk-chart__grid"
        onKeyDown={onGridKeyDown}
        onMouseLeave={() => {
          setHover(null);
        }}
      >
        {blocksOf(rows).map((block) => {
          const caption = blockLabels?.[block.id];
          return (
            <div
              key={block.id}
              role="rowgroup"
              aria-label={caption}
              className="nk-chart__block"
              data-block={block.id}
            >
              {caption !== undefined && (
                <div aria-hidden="true" className="nk-chart__caption text-ui-caption">
                  {caption}
                </div>
              )}
              {block.rows.map(({ row, at }) => renderRow(row, at))}
            </div>
          );
        })}
      </div>
      {legend !== undefined && (
        <div className="nk-chart__legend text-ui-caption" data-testid="kana-legend">
          {LEGEND_STATES.map((state) => (
            <span key={state} className="nk-chart__legend-item">
              <span
                aria-hidden="true"
                className={cx('nk-cell nk-chart__swatch font-jp', `is-${state}`)}
              >
                {legend.sample}
              </span>
              {legend.labels[state]}
            </span>
          ))}
          <span className="nk-chart__legend-item nk-chart__legend-due">
            <span
              aria-hidden="true"
              className="nk-cell nk-chart__swatch font-jp is-confident is-due"
            >
              {legend.sample}
            </span>
            {legend.labels.due}
          </span>
        </div>
      )}
    </div>
  );
}

export type KanaChartPanelLine = {
  readonly text: string;
  // Secondary lines are drawn in `fur-dim`.
  readonly dim?: boolean;
};

export type KanaChartPanelProps = {
  readonly kana: string;
  readonly romaji: string;
  readonly lines: readonly KanaChartPanelLine[];
  readonly closeLabel: string;
  readonly onClose: () => void;
};

/** The details of an activated cell: a panel with everything known about the kana (design 94). */
export function KanaChartPanel({
  kana,
  romaji,
  lines,
  closeLabel,
  onClose,
}: KanaChartPanelProps): JSX.Element {
  return (
    <div className="nk-chart__panel" data-testid="kana-panel">
      <div className="nk-chart__panel-head">
        <span className="font-jp text-jp-test-sm text-fur" lang="ja">
          {kana}
        </span>
        <span className="text-mono-romaji text-fur-dim font-mono">{romaji}</span>
        <Button variant="text" size="sm" className="nk-chart__close" onClick={onClose}>
          {closeLabel}
        </Button>
      </div>
      <div className="nk-chart__panel-lines text-ui-body">
        {lines.map((line, at) => (
          <p key={at} className={line.dim === true ? 'text-fur-dim' : 'text-fur'}>
            {line.text}
          </p>
        ))}
      </div>
    </div>
  );
}
