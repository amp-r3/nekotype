import type { JSX } from 'preact';
import type { LearnKanaKey } from '@nekotype/shared/types';
import type { ChartState } from '@nekotype/model';
import { t } from '@/shared/i18n';
import { cx } from '@/shared/lib';
import { cellStateClass } from '@/shared/ui/kana-cell';
import { displayRomaji } from '@/entities/learn';
import { kanaOfKey } from '../lib/home-copy';

// A kana that opens its details (design decisions 144, 148): a table cell with the state it has now
// (`new`, `learned`... on the home and in the summary), or the bare kana inside a line of text. Both
// take the focus on a click first: Safari does not focus a button on a click, and the dialog gives
// the focus back to what had it.

const focusThen =
  (open: () => void) =>
  (event: MouseEvent): void => {
    if (event.currentTarget instanceof HTMLElement) event.currentTarget.focus();
    open();
  };

export function KanaCell({
  kanaKey,
  state,
  testId,
  onOpen,
}: {
  readonly kanaKey: LearnKanaKey;
  readonly state: ChartState;
  readonly testId: string;
  readonly onOpen: (key: LearnKanaKey) => void;
}): JSX.Element {
  const kana = kanaOfKey(kanaKey);
  return (
    <button
      type="button"
      lang="ja"
      className={cx(
        'nk-cell font-jp',
        cellStateClass(state),
        Array.from(kana).length > 1 ? 'text-jp-cell-sm' : 'text-jp-cell',
      )}
      aria-haspopup="dialog"
      aria-label={t('home.since.cell', {
        kana,
        romaji: displayRomaji(kanaKey),
        state: t(`learn.chart.state.${state}`),
      })}
      data-testid={testId}
      data-kana={kana}
      data-state={state}
      onClick={focusThen(() => {
        onOpen(kanaKey);
      })}
    >
      {kana}
    </button>
  );
}

/** The bare kana of a line (the summary's times and confusions) as a button to its details. */
export function KanaText({
  kanaKey,
  onOpen,
}: {
  readonly kanaKey: LearnKanaKey;
  readonly onOpen: (key: LearnKanaKey) => void;
}): JSX.Element {
  const kana = kanaOfKey(kanaKey);
  return (
    <button
      type="button"
      lang="ja"
      className="font-jp text-jp-body text-fur pointer-coarse:min-h-touch-min pointer-coarse:min-w-touch-min cursor-pointer rounded-xs"
      aria-haspopup="dialog"
      aria-label={t('summary.kana', { kana, romaji: displayRomaji(kanaKey) })}
      data-testid="summary-kana"
      data-kana={kana}
      onClick={focusThen(() => {
        onOpen(kanaKey);
      })}
    >
      {kana}
    </button>
  );
}
