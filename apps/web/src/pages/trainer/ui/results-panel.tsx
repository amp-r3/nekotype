import type { JSX } from 'preact';
import { useRef, useLayoutEffect } from 'preact/hooks';
import { t } from '@/shared/i18n';
import { Button, Notice } from '@/shared/ui';
import type { Session } from '@/features/training';
import { weakestKana, useEnterForNext } from '@/features/training';
import { SpeedChart } from './speed-chart';
import { WeakestKanaList } from './weakest-kana-list';

export type ResultsPanelProps = {
  readonly session: Session;
  readonly onNextTest: () => void;
};

export function ResultsPanel({ session, onNextTest }: ResultsPanelProps): JSX.Element {
  const nextBtnRef = useRef<HTMLButtonElement | null>(null);
  const m = session.metrics.value;
  const results = session.promptResults.value;

  // Enter works also after a click beside the button took the focus away from it.
  useEnterForNext(onNextTest);

  // A layout effect: the focus is on the button before the first frame, so Enter pressed as soon as
  // the screen shows is never lost (a passive effect runs after the paint).
  useLayoutEffect(() => {
    nextBtnRef.current?.focus();
  }, []);

  if (!m) {
    return (
      <div className="text-fur-dim max-w-layout-test mx-auto w-full py-12 text-center">
        <Button variant="primary" buttonRef={nextBtnRef} autoFocus onClick={onNextTest}>
          {t('results.nextTest')}
        </Button>
      </div>
    );
  }

  const endReason = session.endReason.value;
  const endNotice =
    endReason === 'idle'
      ? 'results.endedIdle'
      : endReason === 'hidden'
        ? 'results.endedHidden'
        : null;
  const topWeakest = weakestKana(results);
  const elapsedSec = (m.elapsedMs / 1000).toFixed(1);

  return (
    <div
      data-testid="results-panel"
      className="animate-fadeIn max-w-layout-test mx-auto flex w-full flex-col gap-6 py-6 select-none"
    >
      {/* Polite live region for screen readers (Plan 11.3 & P5 A11y) */}
      <div aria-live="polite" aria-atomic="true" className="sr-only">
        {t('results.summary', {
          wpm: m.wpm,
          accuracy: Math.round(m.accuracy * 100),
          prompts: m.promptsCompleted,
          mistakes: m.mistakes,
        })}
      </div>

      {endNotice !== null && <Notice>{t(endNotice)}</Notice>}

      {/* Header with primary WPM and Accuracy */}
      <div className="border-line flex flex-wrap items-baseline justify-between gap-4 border-b pb-4">
        <div>
          <span className="text-fur-dim text-ui-caption block">{t('results.wpm')}</span>
          <span className="text-fur text-mono-hero-sm sm:text-mono-hero font-mono">{m.wpm}</span>
        </div>

        <div>
          <span className="text-fur-dim text-ui-caption block text-right">
            {t('results.accuracy')}
          </span>
          <span className="text-fur text-mono-stat text-right font-mono">
            {Math.round(m.accuracy * 100)}%
          </span>
        </div>
      </div>

      {/* Speed-over-time chart */}
      <SpeedChart series={m.wpmSeries} />

      {/* Secondary metrics grid */}
      <div className="grid grid-cols-2 gap-4 sm:grid-cols-6">
        <div className="flex flex-col">
          <span className="text-fur-dim text-ui-caption">{t('results.rawWpm')}</span>
          <span className="text-fur text-mono-counter font-mono">{m.rawWpm}</span>
        </div>

        <div className="flex flex-col">
          <span className="text-fur-dim text-ui-caption">{t('results.kanaPerMin')}</span>
          <span className="text-fur text-mono-counter font-mono">{m.kanaPerMin}</span>
        </div>

        <div className="flex flex-col">
          <span className="text-fur-dim text-ui-caption">{t('results.time')}</span>
          <span className="text-fur text-mono-counter font-mono">
            {t('config.seconds.option', { n: elapsedSec })}
          </span>
        </div>

        <div className="flex flex-col">
          <span className="text-fur-dim text-ui-caption">{t('results.completed')}</span>
          <span className="text-fur text-mono-counter font-mono">{m.promptsCompleted}</span>
        </div>

        <div className="flex flex-col">
          <span className="text-fur-dim text-ui-caption">{t('results.mistakes')}</span>
          <span className="text-fur text-mono-counter font-mono">{m.mistakes}</span>
        </div>

        <div className="flex flex-col">
          <span className="text-fur-dim text-ui-caption">{t('results.streak')}</span>
          <span className="text-fur text-mono-counter font-mono">{m.bestStreak}</span>
        </div>
      </div>

      {/* Weakest kana this run */}
      <WeakestKanaList items={topWeakest} />

      {/* Next test button (autofocused) */}
      <div className="flex items-center justify-center pt-4">
        <Button variant="primary" size="lg" buttonRef={nextBtnRef} autoFocus onClick={onNextTest}>
          {t('results.nextTest')}
        </Button>
      </div>
    </div>
  );
}
