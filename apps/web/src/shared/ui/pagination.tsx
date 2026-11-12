import type { JSX } from 'preact';
import { cx } from '../lib';

export type PaginationProps = {
  // 1-based.
  readonly page: number;
  readonly pages: number;
  readonly onPage: (page: number) => void;
  // The edge buttons and the name of the navigation differ per list (history, phrase authors).
  readonly labels: { readonly prev: string; readonly next: string; readonly label: string };
};

const ITEM =
  'pointer-coarse:min-h-touch-min h-control-sm relative cursor-pointer rounded-sm px-2 whitespace-nowrap transition-colors disabled:text-fur-faint disabled:cursor-default';
const IDLE = 'text-fur-dim enabled:hover:text-fur enabled:hover:bg-bg-hover';

/** The first, the last and the neighbours of the current page; `null` stands for the pages left out. */
function pageList(page: number, pages: number): (number | null)[] {
  const list: (number | null)[] = [];
  for (let n = 1; n <= pages; n++) {
    if (n === 1 || n === pages || Math.abs(n - page) <= 1) list.push(n);
    else if (list[list.length - 1] !== null) list.push(null);
  }
  return list;
}

/** Pages of a list (design Pagination): items in the `Segmented` style, edge buttons disabled at the edges. */
export function Pagination({ page, pages, onPage, labels }: PaginationProps): JSX.Element {
  return (
    <nav aria-label={labels.label} className="flex flex-wrap items-center gap-1 select-none">
      <button
        type="button"
        className={cx(ITEM, IDLE, 'text-ui-label')}
        disabled={page <= 1}
        onClick={() => {
          onPage(page - 1);
        }}
      >
        {labels.prev}
      </button>
      {pageList(page, pages).map((n, index) =>
        n === null ? (
          <span key={`gap-${String(index)}`} className="text-fur-dim text-ui-label">
            …
          </span>
        ) : (
          <button
            key={n}
            type="button"
            aria-current={n === page ? 'page' : undefined}
            className={cx(
              ITEM,
              'text-mono-romaji font-mono',
              n === page
                ? 'text-fur after:bg-eye after:absolute after:inset-x-2 after:bottom-0 after:h-0.5'
                : IDLE,
            )}
            onClick={() => {
              if (n !== page) onPage(n);
            }}
          >
            {n}
          </button>
        ),
      )}
      <button
        type="button"
        className={cx(ITEM, IDLE, 'text-ui-label')}
        disabled={page >= pages}
        onClick={() => {
          onPage(page + 1);
        }}
      >
        {labels.next}
      </button>
    </nav>
  );
}
