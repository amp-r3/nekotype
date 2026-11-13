import type { JSX } from 'preact';
import { useRef, useLayoutEffect } from 'preact/hooks';
import { t } from '@/shared/i18n';
import type { TranslationKey } from '@/shared/i18n';
import { Button, Notice } from '@/shared/ui';
import { Cat } from '@/shared/ui/cat';
import { PersonalBestBadge } from '@/shared/ui/personal-best-badge';
import { Stat } from '@/shared/ui/stat';
import { modeLine } from '@/entities/stats';
import type { FinishedTest } from '@/features/training';
import { useEnterForNext } from '@/features/training';
import { accuracyPercent, durationSeconds, kpmComparisons, weakKana } from '../lib/results-model';
import type { Comparison } from '../lib/results-model';
import { WeakKanaList } from './weak-kana-list';

export type ResultsPanelProps = {
  // Null while the result is being saved: the screen offers Next test only.
  readonly finished: FinishedTest | null;
  readonly onNextTest: () => void;
  // Runs the same prompts again (ADR 033); only offered once the result is saved.
  readonly onRepeat: () => void;
};

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

// Each block rises in turn: one `dur-stagger` after the one above it (design `nk-reveal`).
const stagger = (n: number): string => `animation-delay: calc(var(--dur-stagger) * ${n})`;

export function ResultsPanel({ finished, onNextTest, onRepeat }: ResultsPanelProps): JSX.Element {
  const root = useRef<HTMLDivElement | null>(null);
  const ready = finished !== null;

  // Enter is Next test wherever the focus is, except on a control.
  useEnterForNext(onNextTest);

  // The screen holds the focus, not a button: Enter is Next test, and the first Tab reaches Next
  // test, so `tab → enter` starts a new test here as it does during one. A layout effect: the focus
  // is set before the first frame, so a key pressed as soon as the screen shows is never lost. It
  // runs again when the saved result arrives and the screen is a new element.
  useLayoutEffect(() => {
    root.current?.focus({ preventScroll: true });
  }, [ready]);

  if (finished === null) {
    return (
      <div ref={root} tabIndex={-1} className="nk-holds-focus text-fur-dim w-full">
        <Button variant="primary" onClick={onNextTest}>
          {t('results.nextTest')}
        </Button>
      </div>
    );
  }

  const { result, average, previousBest, isBest, kanaErrors } = finished;
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
      ref={root}
      tabIndex={-1}
      data-testid="results-panel"
      className="nk-holds-focus flex w-full flex-col gap-12 pb-6 select-none"
    >
      {/* Polite live region for screen readers */}
      <div aria-live="polite" aria-atomic="true" className="sr-only">
        {t('results.summary', {
          kpm: comparisons.kpm,
          accuracy,
          prompts: result.items,
        })}
      </div>

      {noticeKey !== null && (
        <div className="animate-reveal" style={stagger(0)}>
          <Notice>{t(noticeKey)}</Notice>
        </div>
      )}

      <div className="animate-reveal flex flex-col gap-4" style={stagger(1)}>
        <div data-testid="mode-line" className="text-ui-caption text-fur-dim">
          {modeLine(result)}
        </div>
        <div className="grid grid-cols-[auto_auto] items-end justify-start gap-12">
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
              <Cat mood="content" size={72} />
            </span>
          )}
        </div>
      </div>

      <div className="animate-reveal flex gap-12" style={stagger(2)}>
        <Stat label={t('results.accuracy')} value={accuracy} unit="%" />
        <Stat
          label={t('results.time')}
          value={durationSeconds(result)}
          unit={t('results.timeUnit')}
        />
      </div>

      <WeakKanaList items={weakKana(kanaErrors, result.strictness)} style={stagger(3)} />

      <div className="animate-reveal flex items-center gap-2" style={stagger(4)}>
        <Button variant="primary" size="lg" onClick={onNextTest} hint={t('key.enter')}>
          {t('results.nextTest')}
        </Button>
        <Button size="lg" onClick={onRepeat}>
          {t('results.repeat')}
        </Button>
      </div>
    </div>
  );
}
