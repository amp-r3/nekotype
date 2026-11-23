import './stats.css';
import type { JSX } from 'preact';
import { useEffect } from 'preact/hooks';
import { t } from '@/shared/i18n';
import { Button, Notice } from '@/shared/ui';
import { EmptyState } from '@/shared/ui/empty-state';
import { defaultClock, navigate } from '@/shared/lib';
import { learnTargetMs } from '@/entities/settings';
import {
  legacyInitLearn,
  legacyLearnCounters,
  legacyLearnState,
  legacyLearnStatus,
  localDay,
  legacyRetryLearn,
} from '@/entities/learn';
import { LearningSection } from './learning-section';

// Statistics: the learning progress, all of the screen (design decisions 130, 137).
export function StatsPage(): JSX.Element {
  useEffect(() => {
    void legacyInitLearn(() => learnTargetMs.value);
  }, []);

  const status = legacyLearnStatus.value;
  const has = legacyLearnState.value.activeDays.length > 0 || legacyLearnCounters.value.started > 0;

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
                void legacyRetryLearn();
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
        (has ? (
          <LearningSection today={localDay(defaultClock.now())} />
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
