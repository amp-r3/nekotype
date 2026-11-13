import type { JSX } from 'preact';
import type { RefObject } from 'preact';
import { useEffect } from 'preact/hooks';
import { t } from '@/shared/i18n';
import { Button, Notice } from '@/shared/ui';
import type { SessionSummary } from '../lib/summary';
import { loadSummaryPanel, summaryLoadFailed, summaryPanel } from '../summary-loader';

export type SummaryScreenProps = {
  readonly summary: SessionSummary;
  /** Starts another learning session; called inside the click so a phone keeps its keyboard. */
  readonly onContinue: () => void;
  readonly onTable: () => void;
  /** The hidden field of the page: it holds the focus, so Enter on it still means "continue". */
  readonly inputRef: RefObject<HTMLInputElement | null>;
};

/**
 * The end of a session: the summary (a chunk of its own) and the two actions, which work while the
 * chunk loads or has failed. Enter is "continue" wherever the focus is, except on a link, a control
 * other than the page's hidden field, or in a dialog.
 */
export function SummaryScreen({
  summary,
  onContinue,
  onTable,
  inputRef,
}: SummaryScreenProps): JSX.Element {
  const Panel = summaryPanel.value;
  const failed = summaryLoadFailed.value;

  useEffect(() => {
    void loadSummaryPanel();
  }, []);

  useEffect(() => {
    const onKeyDown = (event: KeyboardEvent): void => {
      if (event.key !== 'Enter' || event.repeat) return;
      if (event.ctrlKey || event.metaKey || event.altKey || event.isComposing) return;
      const target = event.target;
      if (
        target instanceof Element &&
        target !== inputRef.current &&
        target.closest('a, button, select, textarea, input, [role="radio"], dialog[open]') !== null
      ) {
        return;
      }
      if (document.querySelector('dialog[open]') !== null) return;
      event.preventDefault();
      onContinue();
    };
    document.addEventListener('keydown', onKeyDown);
    return () => {
      document.removeEventListener('keydown', onKeyDown);
    };
  }, [onContinue, inputRef]);

  return (
    <section className="mx-auto flex w-full max-w-[880px] flex-col items-start gap-8 pb-12">
      {Panel !== null ? (
        <Panel summary={summary} />
      ) : (
        <Notice
          reserve
          tone={failed ? 'miss' : undefined}
          loading={!failed}
          action={
            failed ? (
              <Button
                variant="secondary"
                size="sm"
                onClick={() => {
                  void loadSummaryPanel();
                }}
              >
                {t('learn.summary.retry')}
              </Button>
            ) : undefined
          }
        >
          {failed ? t('learn.summary.failed') : t('learn.summary.loading')}
        </Notice>
      )}
      <div className="flex flex-wrap items-center gap-2">
        <Button variant="primary" size="lg" onClick={onContinue} hint={t('key.enter')}>
          {t('learn.summary.continue')}
        </Button>
        <Button variant="secondary" size="lg" onClick={onTable}>
          {t('learn.summary.toTable')}
        </Button>
      </div>
    </section>
  );
}
