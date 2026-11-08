import type { JSX } from 'preact';
import { useState, useLayoutEffect } from 'preact/hooks';
import { useComputed } from '@preact/signals';
import { t } from '@/shared/i18n';
import { Button } from '@/shared/ui';
import { createTrainer, useTestInput } from '@/features/training';
import type { Trainer } from '@/features/training';
import { ModePanel } from './mode-panel';
import { TestStage } from './test-stage';
import { loadResultsPanel, resultsLoadFailed, resultsPanel } from '../results-loader';
import { ResultsPending } from './results-pending';

export type TrainerPageProps = {
  // Tests pass a trainer with fixed prompts.
  readonly trainer?: Trainer;
};

export function TrainerPage(props: TrainerPageProps = {}): JSX.Element {
  const [trainer] = useState(() => props.trainer ?? createTrainer());
  const { session } = trainer;
  // Only the end of the test switches the screen. The start of it (idle to running) must not render
  // the page, so this is a computed value that does not change then.
  const finished = useComputed(() => session.phase.value === 'finished');
  const isFinished = finished.value;
  const Results = resultsPanel.value;

  // The results chunk is fetched when idle already; this covers a test that ends before that, and
  // a failed earlier load. A layout effect: a failure left from before is cleared before the paint.
  useLayoutEffect(() => {
    if (isFinished) void loadResultsPanel();
  }, [isFinished]);

  // The field outlives both screens: Restart and Next test give it the focus inside their click
  // (a phone keeps its keyboard open only then). It listens on the test screen, not on the results.
  const input = useTestInput(session, !isFinished);
  const { focusInput } = input;
  const restart = (): void => {
    focusInput();
    trainer.restart();
  };
  // A layout effect: the first frame already shows a prompt, and unmounting stops the trainer at once.
  useLayoutEffect(() => trainer.start(), [trainer]);

  return (
    <div className="flex flex-1 flex-col items-center justify-center gap-6">
      <ModePanel />

      {/* One slot for the notices, always there: a notice appearing must not move the text below. */}
      <div
        data-chrome
        data-testid="stage-notice"
        className="text-ui-label max-w-layout-test mx-auto flex min-h-12 w-full items-center justify-center gap-3 p-2.5 text-center"
      >
        {trainer.contentLoadFailed.value ? (
          <>
            <span role="alert" className="text-miss">
              {t('stage.contentLoadError')}
            </span>
            <Button onClick={trainer.retryContent}>{t('route.retry')}</Button>
          </>
        ) : trainer.isLoadingContent.value ? (
          <span role="status" className="text-fur-dim animate-blink">
            {t('stage.contentLoading')}
          </span>
        ) : null}
      </div>

      {/* The field that takes the keyboard; the stream is only a picture of what it receives. */}
      <input
        ref={input.inputRef}
        type="text"
        onFocus={input.onInputFocus}
        onBlur={input.onInputBlur}
        autoComplete="off"
        autoCapitalize="off"
        autoCorrect="off"
        spellcheck={false}
        lang="en"
        aria-label={t('stage.inputLabel')}
        className="sr-only"
      />

      {isFinished ? (
        Results !== null ? (
          <Results session={session} onNextTest={restart} />
        ) : (
          <ResultsPending
            failed={resultsLoadFailed.value}
            onRetry={() => {
              void loadResultsPanel();
            }}
            onNextTest={restart}
          />
        )
      ) : (
        <TestStage session={session} input={input} onRestart={restart} />
      )}
    </div>
  );
}
