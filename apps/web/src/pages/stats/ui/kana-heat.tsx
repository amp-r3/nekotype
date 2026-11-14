import type { RowCategory } from '@nekotype/engine';
import type { JSX } from 'preact';
import { useRef, useState } from 'preact/hooks';
import { t, tPlural } from '@/shared/i18n';
import { cx } from '@/shared/lib';
import { moveInGrid } from '@/shared/ui/kana-chart-nav';
import type { GridKey } from '@/shared/ui/kana-chart-nav';
import type { HeatCell, HeatRow } from '../lib/kana-heat';

type Props = {
  readonly rows: readonly HeatRow[];
  readonly ariaLabel: string;
};

const ARROWS: Readonly<Record<string, GridKey>> = {
  ArrowLeft: 'left',
  ArrowRight: 'right',
  ArrowUp: 'up',
  ArrowDown: 'down',
};

const STEPS = [1, 2, 3, 4, 5] as const;

function linesOf(cell: HeatCell): string[] {
  return [
    `${cell.kana} · ${cell.romaji}`,
    cell.step === null
      ? t('stats.heat.none')
      : t('stats.heat.errors', {
          rate: Math.round(cell.rate * 100),
          attempts: tPlural('stats.attempts', cell.attempts),
        }),
  ];
}

type Block = { readonly id: RowCategory; readonly rows: readonly { row: HeatRow; at: number }[] };

function blocksOf(rows: readonly HeatRow[]): readonly Block[] {
  const blocks: { id: RowCategory; rows: { row: HeatRow; at: number }[] }[] = [];
  rows.forEach((row, at) => {
    const last = blocks[blocks.length - 1];
    if (last !== undefined && last.id === row.block) last.rows.push({ row, at });
    else blocks.push({ id: row.block, rows: [{ row, at }] });
  });
  return blocks;
}

function blockLabel(id: RowCategory): string {
  switch (id) {
    case 'basic':
      return t('learn.chart.block.basic');
    case 'dakuten':
      return t('learn.chart.block.voiced');
    case 'yoon':
      return t('learn.chart.block.combinations');
    case 'extended':
      return t('learn.chart.block.extended');
  }
}

/**
 * The kana table of a script filled by the share of typing attempts with an error (design
 * `KanaChart` `miss`). The geometry is the table on `/`; cells are not locked and open nothing.
 */
export function KanaHeat({ rows, ariaLabel }: Props): JSX.Element {
  const first = rows.flatMap((row) => row.cells).find((cell) => cell !== null);
  const [stop, setStop] = useState<string | undefined>(first?.id);
  const [hover, setHover] = useState<string | null>(null);
  const [focused, setFocused] = useState<string | null>(null);
  const buttons = useRef(new Map<string, HTMLButtonElement>());

  const present = rows.map((row) => row.cells.map((cell) => cell !== null));
  const known = rows.some((row) => row.cells.some((cell) => cell?.id === stop));
  const tabStop = known ? stop : first?.id;
  const tip = hover ?? focused;

  function onKeyDown(event: KeyboardEvent, rowAt: number, slot: number, cell: HeatCell): void {
    const key = ARROWS[event.key];
    if (key === undefined) return;
    event.preventDefault();
    const to = moveInGrid(present, { row: rowAt, slot }, key);
    const target = rows[to.row]?.cells[to.slot];
    if (target === null || target === undefined || target.id === cell.id) return;
    setStop(target.id);
    buttons.current.get(target.id)?.focus();
  }

  return (
    <div className="nk-chart" data-testid="kana-heat">
      <div
        role="grid"
        aria-label={ariaLabel}
        className="nk-chart__grid"
        onMouseLeave={() => {
          setHover(null);
        }}
      >
        {blocksOf(rows).map((block) => (
          <div
            key={block.id}
            role="rowgroup"
            aria-label={blockLabel(block.id)}
            className="nk-chart__block"
          >
            <div aria-hidden="true" className="nk-chart__caption text-ui-caption">
              {blockLabel(block.id)}
            </div>
            {block.rows.map(({ row, at }) => (
              <div key={row.id} role="row" className="nk-chart__row">
                <div
                  role="rowheader"
                  aria-label={row.id === 'vowels' ? t('learn.chart.vowels') : row.name}
                  className="nk-chart__head"
                >
                  <span aria-hidden="true">{row.head}</span>
                </div>
                {row.cells.map((cell, slot) =>
                  cell === null ? (
                    <div
                      key={`gap-${slot}`}
                      role="gridcell"
                      aria-hidden="true"
                      className="nk-cell"
                    />
                  ) : (
                    <div key={cell.id} role="gridcell" className="nk-chart__slot">
                      <button
                        type="button"
                        ref={(el) => {
                          if (el === null) buttons.current.delete(cell.id);
                          else buttons.current.set(cell.id, el);
                        }}
                        className={cx(
                          'nk-cell nk-heat font-jp',
                          cell.step === null ? 'is-untyped' : `is-heat-${cell.step}`,
                          Array.from(cell.kana).length > 1 ? 'text-jp-cell-sm' : 'text-jp-cell',
                        )}
                        lang="ja"
                        tabIndex={cell.id === tabStop ? 0 : -1}
                        aria-label={linesOf(cell).join(', ')}
                        data-testid="heat-cell"
                        data-kana={cell.kana}
                        data-step={cell.step ?? 'none'}
                        onKeyDown={(event) => {
                          onKeyDown(event, at, slot, cell);
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
                        onClick={() => {
                          setStop(cell.id);
                        }}
                      >
                        {cell.kana}
                      </button>
                      {tip === cell.id && (
                        <span
                          aria-hidden="true"
                          className={cx(
                            'nk-chart__tip',
                            slot === 0 && 'is-start',
                            slot >= row.cells.length - 1 && row.cells.length > 2 && 'is-end',
                          )}
                          data-testid="heat-tooltip"
                        >
                          {linesOf(cell).map((line, index) => (
                            <span key={index} className="block">
                              {line}
                            </span>
                          ))}
                        </span>
                      )}
                    </div>
                  ),
                )}
              </div>
            ))}
          </div>
        ))}
      </div>
      <div className="nk-chart__legend text-ui-caption" data-testid="heat-legend">
        <span className="nk-chart__legend-item">
          {t('stats.heat.fewer')}
          {STEPS.map((step) => (
            <span
              key={step}
              aria-hidden="true"
              className={`nk-cell nk-chart__swatch nk-heat is-heat-${step}`}
            />
          ))}
          {t('stats.heat.more')}
        </span>
        <span className="nk-chart__legend-item">
          <span aria-hidden="true" className="nk-cell nk-chart__swatch nk-heat is-untyped" />
          {t('stats.heat.none')}
        </span>
      </div>
    </div>
  );
}
