import type { JSX } from 'preact';
import type { RefObject } from 'preact';
import { useEffect } from 'preact/hooks';
import { t } from '@/shared/i18n';
import { Button, Notice } from '@/shared/ui';
import type { Track } from '@nekotype/shared/types';
import { defaultClock } from '@/shared/lib';
import { openKanaDetails } from '@/features/kana-details';
import { whenOf } from '../lib/home-copy';
import type { SessionSummary } from '../lib/summary';
import type { SummaryModel } from '../model/summary';
import { loadSummaryPanel, summaryLoadFailed, summaryPanel } from '../summary-loader';

export type SummaryScreenProps = {
  readonly summary: SessionSummary;
  /** The forecast change and whether there is something to do next (P8 plan, D2, D9). */
  readonly model: SummaryModel;
  /** The session's track, for the forecast's words. */
  readonly track: Track;
  /**
   * Starts another learning session; called inside the click so a phone keeps its keyboard. Only
   * called when there is something to do.
   */
  readonly onContinue: () => void;
  /** Back to `/`, the home. */
  readonly onHome: () => void;
  /** The hidden field of the page: it holds the focus, so Enter on it still means "continue". */
  readonly inputRef: RefObject<HTMLInputElement | null>;
};

/**
 * The end of a session: the summary (a chunk of its own) and the two actions, which work while the
 * chunk loads or has failed. Enter is the primary action wherever the focus is, except on a link, a
 * control other than the page's hidden field, or in a dialog: "continue", or "home" when the model
 * has nothing to offer (design decision 148).
 */
export function SummaryScreen({
  summary,
  model,
  track,
  onContinue,
  onHome,
  inputRef,
}: SummaryScreenProps): JSX.Element {
  const Panel = summaryPanel.value;
  const failed = summaryLoadFailed.value;
  const reason = model.reason.value;
  const nothing = reason?.kind === 'none';
  const canStart = model.canStart.value;

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
      if (model.reason.peek()?.kind === 'none') onHome();
      else if (model.canStart.peek()) onContinue();
    };
    document.addEventListener('keydown', onKeyDown);
    return () => {
      document.removeEventListener('keydown', onKeyDown);
    };
  }, [onContinue, onHome, model, inputRef]);

  return (
    <section className="flex w-full max-w-[880px] flex-col items-start gap-8 pb-12">
      {/* The title stands while the summary chunk loads or has failed, as over the summary. */}
      <h1 className="text-ui-heading text-fur">{t('learn.summary.title')}</h1>
      {Panel !== null ? (
        <Panel
          summary={summary}
          change={model.change.value}
          track={track}
          onOpen={openKanaDetails}
        />
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
      {nothing && (
        <p className="text-fur-dim text-ui-body" data-testid="summary-nothing">
          {`${t('learn.reason.none')} · ${t('learn.nextReview', { when: whenOf(reason.nextAt, defaultClock.now()) })}`}
        </p>
      )}
      <div className="flex flex-wrap items-center gap-2">
        {!nothing && (
          <Button
            variant="primary"
            size="lg"
            disabled={!canStart}
            onClick={onContinue}
            hint={t('key.enter')}
            hintClassName="pointer-coarse:hidden"
          >
            {t('learn.summary.continue')}
          </Button>
        )}
        <Button
          variant={nothing ? 'primary' : 'secondary'}
          size="lg"
          onClick={onHome}
          {...(nothing ? { hint: t('key.enter'), hintClassName: 'pointer-coarse:hidden' } : {})}
        >
          {t('learn.summary.home')}
        </Button>
      </div>
    </section>
  );
}
