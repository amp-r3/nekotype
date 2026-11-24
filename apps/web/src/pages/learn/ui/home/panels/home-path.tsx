import type { JSX } from 'preact';
import { useMemo, useState } from 'preact/hooks';
import type { RowCategory } from '@nekotype/engine';
import type { LearnView } from '@nekotype/model';
import { t } from '@/shared/i18n';
import type { Track } from '@nekotype/shared/types';
import { pathOf } from '@/entities/learn';
import type { PathRow, RowState, TrackPath } from '@/entities/learn';
import { kanaOfKey, rowLabel } from '../../../lib/home-copy';

const BLOCK_NAMES = {
  basic: 'learn.chart.block.basic',
  dakuten: 'learn.chart.block.voiced',
  yoon: 'learn.chart.block.combinations',
  extended: 'learn.chart.block.extended',
} as const;

const TICK: Readonly<Record<RowState, string>> = {
  done: 'bg-fur-dim',
  current: 'bg-eye',
  locked: 'bg-line-strong',
};

/** The block shown open by default: the current one, the last when the track is complete. */
function defaultBlock(path: TrackPath): RowCategory | null {
  const current = path.blocks.find((block) => block.state === 'current');
  return (current ?? path.blocks[path.blocks.length - 1])?.category ?? null;
}

function Column({ row, view }: { readonly row: PathRow; readonly view: LearnView }): JSX.Element {
  const current = row.state === 'current';
  return (
    <li
      className="flex flex-col items-center gap-1"
      aria-current={current ? 'step' : undefined}
      aria-label={
        current
          ? t('home.path.here', {
              row: rowLabel(row.id),
              n: row.introduced,
              total: row.total,
            })
          : undefined
      }
      data-row={row.id}
      data-state={row.state}
    >
      <span aria-hidden="true" className={`h-0.5 w-full rounded-xs ${TICK[row.state]}`} />
      <span aria-hidden="true" className="text-mono-small text-fur-dim font-mono">
        {row.head === '' ? '·' : row.head}
      </span>
      {row.keys.map((key) => {
        const open = view.kana.get(key)?.state !== 'locked';
        return (
          <span
            key={key}
            aria-hidden={current ? 'true' : undefined}
            lang="ja"
            className={`font-jp text-jp-body ${open ? (current ? 'text-fur' : 'text-fur-dim') : 'text-fur-faint'}`}
          >
            {kanaOfKey(key)}
          </span>
        );
      })}
      {current && (
        <span aria-hidden="true" className="text-mono-small text-fur-dim font-mono">
          {row.introduced}/{row.total}
        </span>
      )}
    </li>
  );
}

// The path of a track (design decision 143): the blocks in a row, each a button with its name, its
// count and a tick per row; the open block lists its rows as columns. The current block is open
// until the learner opens another.
export function HomePath({
  view,
  track,
}: {
  readonly view: LearnView;
  readonly track: Track;
}): JSX.Element {
  const path = useMemo(() => pathOf(view, track), [view, track]);
  const [choice, setChoice] = useState<{
    readonly track: string;
    readonly category: RowCategory;
  } | null>(null);
  const open =
    choice !== null && choice.track === path.track ? choice.category : defaultBlock(path);

  return (
    <div className="flex flex-col gap-4" data-testid="home-path">
      <div className="flex flex-wrap gap-x-3 gap-y-3">
        {path.blocks.map((block) => {
          const expanded = block.category === open;
          return (
            <button
              key={block.category}
              type="button"
              aria-expanded={expanded}
              aria-controls={`home-path-${block.category}`}
              data-testid={`home-block-${block.category}`}
              style={{ flexGrow: block.rows.length }}
              className="flex min-w-0 cursor-pointer flex-col items-stretch gap-1 text-left"
              onClick={() => {
                setChoice({ track: path.track, category: block.category });
              }}
            >
              <span className="flex items-baseline justify-between gap-2">
                <span className={`text-ui-label ${expanded ? 'text-fur' : 'text-fur-dim'}`}>
                  {t(BLOCK_NAMES[block.category])}
                </span>
                <span className="text-mono-small text-fur-dim font-mono">
                  {block.introduced}/{block.total}
                </span>
              </span>
              <span aria-hidden="true" className="flex gap-0.5">
                {block.rows.map((row) => (
                  <span key={row.id} className={`h-0.5 flex-1 rounded-xs ${TICK[row.state]}`} />
                ))}
              </span>
            </button>
          );
        })}
      </div>
      {path.blocks.map((block) => (
        <ol
          key={block.category}
          id={`home-path-${block.category}`}
          hidden={block.category !== open}
          aria-label={t(BLOCK_NAMES[block.category])}
          className={block.category === open ? 'flex flex-wrap gap-x-3 gap-y-4' : 'hidden'}
        >
          {block.rows.map((row) => (
            <Column key={row.id} row={row} view={view} />
          ))}
        </ol>
      ))}
    </div>
  );
}
