import type { JSX } from 'preact';
import { useRef, useLayoutEffect } from 'preact/hooks';
import { t } from '@/shared/i18n';
import type { TranslationKey } from '@/shared/i18n';
import { Button, Kbd, Notice } from '@/shared/ui';
import { Cat } from '@/shared/ui/cat';
import { PersonalBestBadge } from '@/shared/ui/personal-best-badge';
import { Stat } from '@/shared/ui/stat';
import type { FinishedTest } from '@/features/training';
import { useEnterForNext } from '@/features/training';
import type { TestResult } from '@nekotype/shared/types';
import { accuracyPercent, durationSeconds, kpmComparisons, weakKana } from '../lib/results-model';
import type { Comparison } from '../lib/results-model';
import { WeakKanaList } from './weak-kana-list';

export type ResultsPanelProps = {
  // Null while the result is being saved: the screen offers Next test only.
  readonly finished: FinishedTest | null;
  readonly onNextTest: () => void;
};

function modeLine(result: TestResult): string {
  const { config } = result;
  const mode =
    config.kind === 'time'
      ? t('results.mode.time', { n: config.seconds })
      : config.kind === 'count'
        ? t('results.mode.count', { n: config.prompts })
        : t('results.mode.zen');
  return t('results.modeLine', {
    content: t(`results.content.${result.content}`),
    script: t(`results.script.${result.script}`),
    strictness: t(`results.strictness.${result.strictness}`),
    mode,
  });
}

function ComparisonLine({
  comparison,
  label,
}: {
  readonly comparison: Comparison;
  readonly label: TranslationKey;
}): JSX.Element {
  return (
    <span>
      <span className="text-fur text-mono-romaji font-mono">{comparison.delta}</span> {t(label)} (
      <span className="text-mono-romaji font-mono">{comparison.reference}</span>)
    </span>
  );
}

export function ResultsPanel({ finished, onNextTest }: ResultsPanelProps): JSX.Element {
  const nextBtnRef = useRef<HTMLButtonElement | null>(null);
  const ready = finished !== null;

  // Enter works also after a click beside the button took the focus away from it.
  useEnterForNext(onNextTest);

  // A layout effect: the focus is on the button before the first frame, so Enter pressed as soon as
  // the screen shows is never lost (a passive effect runs after the paint). It runs again when the
  // saved result arrives and the button is a new element.
  useLayoutEffect(() => {
    nextBtnRef.current?.focus();
  }, [ready]);

  if (finished === null) {
    return (
      <div className="text-fur-dim max-w-layout-test mx-auto w-full py-12 text-center">
        <Button variant="primary" buttonRef={nextBtnRef} autoFocus onClick={onNextTest}>
          {t('results.nextTest')}
        </Button>
      </div>
    );
  }

  const { result, average, previousBest, isBest, kanaDelta } = finished;
  const comparisons = kpmComparisons(result, average, previousBest);
  const noticeKey =
    result.endReason === 'idle'
      ? 'results.endedIdle'
      : result.endReason === 'hidden'
        ? 'results.endedHidden'
        : null;
  const accuracy = accuracyPercent(result);

  return (
    <div
      data-testid="results-panel"
      className="animate-fadeIn max-w-layout-test mx-auto flex w-full flex-col gap-6 py-6 select-none"
    >
      {/* Polite live region for screen readers */}
      <div aria-live="polite" aria-atomic="true" className="sr-only">
        {t('results.summary', {
          kpm: comparisons.kpm,
          accuracy,
          prompts: result.items,
        })}
      </div>

      {noticeKey !== null && <Notice>{t(noticeKey)}</Notice>}

      <div className="flex flex-col gap-3">
        <div data-testid="mode-line" className="text-ui-caption text-fur-dim">
          {modeLine(result)}
        </div>
        <div className="flex items-end justify-between gap-4">
          <Stat
            size="hero"
            label={t('results.kpm')}
            value={comparisons.kpm}
            badge={isBest ? <PersonalBestBadge /> : undefined}
            comparisons={
              <>
                {comparisons.average !== null && (
                  <ComparisonLine comparison={comparisons.average} label="results.vsAverage" />
                )}
                {comparisons.best !== null && (
                  <ComparisonLine
                    comparison={comparisons.best}
                    label={isBest ? 'results.vsPreviousBest' : 'results.vsBest'}
                  />
                )}
              </>
            }
          />
          {isBest && (
            <span role="img" aria-label={t('results.catLabel')}>
              <Cat mood="content" size={80} />
            </span>
          )}
        </div>
      </div>

      <div className="flex gap-8">
        <Stat label={t('results.accuracy')} value={`${String(accuracy)} %`} />
        <Stat
          label={t('results.time')}
          value={t('results.timeValue', { n: durationSeconds(result) })}
        />
      </div>

      <WeakKanaList items={weakKana(kanaDelta, result.strictness)} />

      <div className="flex items-center justify-center pt-4">
        <Button variant="primary" size="lg" buttonRef={nextBtnRef} autoFocus onClick={onNextTest}>
          {t('results.nextTest')} <Kbd>{t('key.enter')}</Kbd>
        </Button>
      </div>
    </div>
  );
}
