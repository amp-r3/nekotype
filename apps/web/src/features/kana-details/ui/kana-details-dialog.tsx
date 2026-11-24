import type { LearnKanaKey } from '@nekotype/shared/types';
import type { JSX } from 'preact';
import { useRef } from 'preact/hooks';
import { t } from '@/shared/i18n';
import { defaultClock } from '@/shared/lib';
import { Dialog } from '@/shared/ui';
import { displayRomaji, learnView } from '@/entities/learn';
import { detailsRows } from '../lib/lines';

export type KanaDetailsDialogProps = {
  /** The open kana, or null while closed: the dialog stays mounted, so closing gives the focus back. */
  readonly kanaKey: LearnKanaKey | null;
  readonly onClose: () => void;
};

/** The memory stroke: 2 px, at most 240 px, full at 21 days, `fur` once mastered (decision 147). */
function MemoryStroke({
  fill,
  mastered,
}: {
  readonly fill: number;
  readonly mastered: boolean;
}): JSX.Element {
  return (
    <span
      aria-hidden="true"
      className="bg-line-strong mt-2 block h-0.5 max-w-60"
      data-testid="kana-details-memory"
    >
      <span
        className={mastered ? 'bg-fur block h-full' : 'bg-fur-dim block h-full'}
        style={{ width: `${Math.round(fill * 100)}%` }}
      />
    </span>
  );
}

// The details of a kana (design decision 147): what is known about it, as a dialog. Opened from the
// table, the home and the summary; never during a session.
export function KanaDetailsDialog({ kanaKey, onClose }: KanaDetailsDialogProps): JSX.Element {
  // The last kana stays while the dialog closes, so its content does not vanish mid-way.
  const shown = useRef<LearnKanaKey | null>(null);
  if (kanaKey !== null) shown.current = kanaKey;
  const key = shown.current;
  const view = key === null ? undefined : learnView.value?.kana.get(key);
  const kana = key === null ? '' : key.slice(key.indexOf(':') + 1);

  return (
    <Dialog
      open={kanaKey !== null && view !== undefined && view.state !== 'locked'}
      onClose={onClose}
      closeLabel={t('details.close')}
      title={
        key === null ? (
          ''
        ) : (
          <>
            <span className="font-jp text-jp-test-sm" lang="ja">
              {kana}
            </span>{' '}
            <span className="text-mono-romaji text-fur-dim font-mono">{displayRomaji(key)}</span>
          </>
        )
      }
    >
      {view !== undefined && view.state !== 'locked' && (
        <dl className="grid grid-cols-[auto_1fr] gap-x-6 gap-y-3" data-testid="kana-details">
          {detailsRows(view, defaultClock.now()).map((row) => (
            <div key={row.id} className="contents">
              <dt className="text-ui-caption text-fur-dim">{row.caption}</dt>
              <dd className="text-ui-body text-fur">
                {row.value.map((run, at) =>
                  run.kana === true ? (
                    <span key={at} className="font-jp text-jp-body" lang="ja">
                      {run.text}
                    </span>
                  ) : (
                    run.text
                  ),
                )}
                {row.fill !== undefined && (
                  <MemoryStroke fill={row.fill} mastered={view.state === 'mastered'} />
                )}
              </dd>
            </div>
          ))}
        </dl>
      )}
    </Dialog>
  );
}
