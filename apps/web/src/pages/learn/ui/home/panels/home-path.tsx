import type { JSX } from 'preact';
import { useMemo, useState } from 'preact/hooks';
import type { RowCategory } from '@nekotype/engine';
import type { LearnView } from '@nekotype/model';
import { t } from '@/shared/i18n';
import { Segmented } from '@/shared/ui';
import type { Track } from '@nekotype/shared/types';
import { pathOf } from '@/entities/learn';
import type { PathBlock, PathRow, RowState, TrackPath } from '@/entities/learn';
import { kanaOfKey, rowLabel } from '../../../lib/home-copy';

const BLOCK_NAMES = {
  basic: 'learn.chart.block.basic',
  dakuten: 'learn.chart.block.voiced',
  yoon: 'learn.chart.block.combinations',
  extended: 'learn.chart.block.extended',
} as const;

/** The block shown open by default: the current one, the last when the track is complete. */
function defaultBlock(path: TrackPath): RowCategory | null {
  const current = path.blocks.find((block) => block.state === 'current');
  return (current ?? path.blocks[path.blocks.length - 1])?.category ?? null;
}

const HEAD: Readonly<Record<RowState, string>> = {
  done: 'text-fur-dim',
  current: 'text-eye',
  locked: 'text-fur-faint',
};

/** The kana of a block's name: `fur` open, `fur-dim` started, `fur-faint` locked. */
function blockKanaClass(block: PathBlock, open: boolean): string {
  return open ? 'text-fur' : block.state === 'locked' ? 'text-fur-faint' : 'text-fur-dim';
}

function Column({ row, view }: { readonly row: PathRow; readonly view: LearnView }): JSX.Element {
  const current = row.state === 'current';
  // The caret stands before the kana that opens next: the first locked one of the current row.
  const next = current ? row.keys.find((key) => view.kana.get(key)?.state === 'locked') : undefined;
  return (
    <li
      className="flex min-w-0 flex-col items-center sm:flex-1"
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
      <span aria-hidden="true" className={`text-mono-small font-mono ${HEAD[row.state]}`}>
        {/* The vowels have no head: an empty line of the same height. */}
        {row.head === '' ? '\u00a0' : row.head}
      </span>
      {row.keys.map((key) => {
        const open = view.kana.get(key)?.state !== 'locked';
        return (
          <span
            key={key}
            aria-hidden={current ? 'true' : undefined}
            lang="ja"
            className={`font-jp text-jp-body sm:text-jp-cell relative ${open ? (current ? 'text-fur' : 'text-fur-dim') : 'text-fur-faint'}`}
          >
            {key === next && <span aria-hidden="true" className="nk-caret nk-home__caret" />}
            {kanaOfKey(key)}
          </span>
        );
      })}
      {current && (
        <span aria-hidden="true" className="text-mono-small text-fur-dim mt-1 font-mono">
          {row.introduced}/{row.total}
        </span>
      )}
    </li>
  );
}

// The path of a track (design decision 155): the blocks as a chain of the kinds of kana, a
// `Segmented` in the order they open; the open block lists its rows as columns with a caret before
// the kana that opens next. The current block is open until the learner chooses another.
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
  const shown = path.blocks.find((block) => block.category === open);

  return (
    <div className="flex flex-col gap-4" data-testid="home-path">
      {open !== null && (
        <Segmented<RowCategory>
          className="nk-blocks"
          tall
          ariaLabel={t('home.path.blocks')}
          value={open}
          onChange={(category) => {
            setChoice({ track: path.track, category });
          }}
          options={path.blocks.map((block) => {
            const name = t(BLOCK_NAMES[block.category]);
            const selected = block.category === open;
            const first = block.rows[0]?.keys[0];
            return {
              value: block.category,
              testId: `home-block-${block.category}`,
              label: t('home.path.block', {
                name,
                n: block.introduced,
                total: block.total,
              }),
              content: (
                <>
                  {first !== undefined && (
                    <span
                      lang="ja"
                      aria-hidden="true"
                      className={`font-jp text-jp-cell sm:text-jp-test-sm ${blockKanaClass(block, selected)}`}
                    >
                      {kanaOfKey(first)}
                    </span>
                  )}
                  <span className="text-ui-label">{name}</span>
                  <span
                    className={`text-mono-small font-mono ${selected ? 'text-fur-dim' : 'text-fur-faint'}`}
                  >
                    {block.introduced}/{block.total}
                  </span>
                </>
              ),
            };
          })}
        />
      )}
      {shown !== undefined && (
        <ol
          id={`home-path-${shown.category}`}
          aria-label={t(BLOCK_NAMES[shown.category])}
          data-testid={`home-rows-${shown.category}`}
          className="nk-rows flex flex-wrap gap-x-3 gap-y-4 sm:flex-nowrap sm:gap-x-6"
        >
          {shown.rows.map((row) => (
            <Column key={row.id} row={row} view={view} />
          ))}
        </ol>
      )}
    </div>
  );
}
