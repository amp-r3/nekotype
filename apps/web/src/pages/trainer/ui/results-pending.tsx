import type { JSX } from 'preact';
import { useLayoutEffect, useRef } from 'preact/hooks';
import { t } from '@/shared/i18n';
import { Button, Notice } from '@/shared/ui';
import { useEnterForNext } from '@/features/training';

export type ResultsPendingProps = {
  readonly failed: boolean;
  readonly onRetry: () => void;
  readonly onNextTest: () => void;
};

/**
 * Stands in for the results screen while its chunk loads, or when it could not be loaded. Next test
 * works in both states, by button and by Enter, so a failed chunk never traps the user.
 */
export function ResultsPending({ failed, onRetry, onNextTest }: ResultsPendingProps): JSX.Element {
  const root = useRef<HTMLDivElement | null>(null);
  useEnterForNext(onNextTest);
  // As on the results: the screen holds the focus, so Enter and `tab → enter` are Next test.
  useLayoutEffect(() => {
    root.current?.focus({ preventScroll: true });
  }, []);

  return (
    <div
      ref={root}
      tabIndex={-1}
      data-testid="results-pending"
      className="nk-holds-focus flex w-full flex-col items-start gap-12 pb-6"
    >
      <Notice
        reserve
        tone={failed ? 'miss' : undefined}
        loading={!failed}
        action={
          failed ? (
            <Button variant="secondary" size="sm" onClick={onRetry}>
              {t('route.retry')}
            </Button>
          ) : undefined
        }
      >
        {failed ? t('route.loadError') : t('route.loading')}
      </Notice>
      <Button variant="primary" size="lg" onClick={onNextTest} hint={t('key.enter')}>
        {t('results.nextTest')}
      </Button>
    </div>
  );
}
