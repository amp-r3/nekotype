import type { JSX } from 'preact';
import { useEffect } from 'preact/hooks';
import { t } from '@/shared/i18n';
import { Button, Kbd } from '@/shared/ui';
import type { SessionSummary } from '../lib/summary';
import { loadSummaryPanel, summaryLoadFailed, summaryPanel } from '../summary-loader';

export type SummaryScreenProps = {
  readonly summary: SessionSummary;
  /** Starts another learning session; called inside the click so a phone keeps its keyboard. */
  readonly onContinue: () => void;
  readonly onTable: () => void;
};

/**
 * The end of a session: the summary (a chunk of its own) and the two actions, which work while the
 * chunk loads or has failed. Enter is "continue" wherever the focus is, except on a link, a control
 * or in a dialog.
 */
export function SummaryScreen({ summary, onContinue, onTable }: SummaryScreenProps): JSX.Element {
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
  }, [onContinue]);

  return (
    <section className="max-w-layout-test mx-auto flex w-full flex-col items-start gap-8 py-12">
      {Panel !== null ? (
        <Panel summary={summary} />
      ) : failed ? (
        <div className="flex flex-col items-start gap-2">
          <p role="alert" className="text-miss text-ui-body">
            {t('learn.summary.failed')}
          </p>
          <Button
            variant="text"
            size="sm"
            onClick={() => {
              void loadSummaryPanel();
            }}
          >
            {t('learn.summary.retry')}
          </Button>
        </div>
      ) : (
        <p role="status" className="text-fur-dim text-ui-label">
          {t('learn.summary.loading')}
        </p>
      )}
      <div className="flex flex-wrap items-center gap-3">
        <Button variant="primary" size="lg" onClick={onContinue}>
          {t('learn.summary.continue')}
          <Kbd>{t('key.enter')}</Kbd>
        </Button>
        <Button variant="secondary" size="lg" onClick={onTable}>
          {t('learn.summary.toTable')}
        </Button>
      </div>
    </section>
  );
}
