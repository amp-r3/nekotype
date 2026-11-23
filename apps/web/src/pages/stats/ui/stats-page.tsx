import './stats.css';
import type { JSX } from 'preact';
import { useEffect } from 'preact/hooks';
import { t } from '@/shared/i18n';
import { Button, Notice } from '@/shared/ui';
import { EmptyState } from '@/shared/ui/empty-state';
import { defaultClock, navigate } from '@/shared/lib';
import { learnTargetMs } from '@/entities/settings';
import { initLearn, learnStatus, learnView, localDay, retryLearn } from '@/entities/learn';
import { LearningSection } from './learning-section';

// Statistics: the learning progress, all of the screen (design decisions 130, 137).
export function StatsPage(): JSX.Element {
  useEffect(() => {
    void initLearn(() => learnTargetMs.value);
  }, []);

  const status = learnStatus.value;
  const view = learnView.value;
  const has = view !== null && (view.stats.days.size > 0 || view.stats.started > 0);

  return (
    <section className="max-w-layout-max mx-auto flex w-full flex-col gap-8 sm:gap-12">
      <h1 className="text-ui-title text-fur">{t('page.stats')}</h1>
      {status === 'loading' && <Notice loading>{t('route.loading')}</Notice>}
      {status === 'error' && (
        <Notice
          tone="miss"
          action={
            <Button
              variant="secondary"
              size="sm"
              onClick={() => {
                void retryLearn();
              }}
            >
              {t('learn.retry')}
            </Button>
          }
        >
          {t('learn.loadError')}
        </Notice>
      )}
      {status === 'ready' &&
        view !== null &&
        (has ? (
          <LearningSection view={view} today={localDay(defaultClock.now())} />
        ) : (
          <EmptyState
            title={t('stats.empty.title')}
            text={t('stats.empty.text')}
            action={
              <Button
                variant="primary"
                onClick={() => {
                  navigate('/');
                }}
              >
                {t('stats.empty.action')}
              </Button>
            }
          />
        ))}
    </section>
  );
}
