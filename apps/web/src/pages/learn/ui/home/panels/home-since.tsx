import type { JSX } from 'preact';
import type { LearnKanaKey } from '@nekotype/shared/types';
import type { Stronger } from '@nekotype/model';
import { t } from '@/shared/i18n';
import { cx } from '@/shared/lib';
import { cellStateClass } from '@/shared/ui/kana-cell';
import { displayRomaji } from '@/entities/learn';
import type { StrongerState } from '@/entities/learn';
import { kanaOfKey } from '../../../lib/home-copy';

export type SinceGroup = 'new' | 'learned' | 'mastered' | 'stronger';

const GROUPS: readonly SinceGroup[] = ['new', 'learned', 'mastered', 'stronger'];

/** The group of a changed kana: each is in exactly one, and a kana that was locked is new. */
export function groupOf(item: Stronger): SinceGroup {
  if (item.from === 'locked') return 'new';
  if (item.to === 'mastered' && item.from !== 'mastered') return 'mastered';
  if (item.to === 'learned' && item.from === 'learning') return 'learned';
  return 'stronger';
}

// "Since the last session" (design decision 144): the kana that rose, as table cells under their
// group, each opening its details. Not shown on the first visit; the place keeps its height while
// the insights compute.
export function HomeSince({
  state,
  onOpen,
}: {
  readonly state: StrongerState;
  readonly onOpen: (key: LearnKanaKey) => void;
}): JSX.Element | null {
  if (state.kind === 'first') return null;
  return (
    <section
      className="flex flex-col gap-4"
      aria-labelledby="home-since-title"
      aria-busy={state.kind === 'pending' ? 'true' : undefined}
      data-testid={state.kind === 'ready' ? 'home-stronger' : undefined}
    >
      <h2 id="home-since-title" className="text-ui-heading text-fur">
        {t('home.since.title')}
      </h2>
      {state.kind === 'pending' && <div aria-hidden="true" className="min-h-12" />}
      {state.kind === 'ready' && state.kana.length === 0 && (
        <p className="text-ui-body text-fur-dim">{t('home.since.empty')}</p>
      )}
      {state.kind === 'ready' &&
        GROUPS.map((group) => {
          const items = state.kana.filter((item) => groupOf(item) === group);
          if (items.length === 0) return null;
          return (
            <div key={group} className="flex flex-col gap-2" data-group={group}>
              <h3 className="text-ui-caption text-fur-dim">{t(`home.since.${group}`)}</h3>
              <ul className="flex flex-wrap gap-1">
                {items.map((item) => {
                  const kana = kanaOfKey(item.key);
                  return (
                    <li key={item.key}>
                      <button
                        type="button"
                        lang="ja"
                        className={cx(
                          'nk-cell font-jp',
                          cellStateClass(item.to),
                          Array.from(kana).length > 1 ? 'text-jp-cell-sm' : 'text-jp-cell',
                        )}
                        aria-haspopup="dialog"
                        aria-label={t('home.since.cell', {
                          kana,
                          romaji: displayRomaji(item.key),
                          state: t(`learn.chart.state.${item.to}`),
                        })}
                        data-testid="since-cell"
                        data-kana={kana}
                        data-state={item.to}
                        onClick={(event) => {
                          // Takes the focus first: Safari does not focus a button on a click, and
                          // the dialog gives the focus back to what had it.
                          event.currentTarget.focus();
                          onOpen(item.key);
                        }}
                      >
                        {kana}
                      </button>
                    </li>
                  );
                })}
              </ul>
            </div>
          );
        })}
    </section>
  );
}
