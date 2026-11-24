import './stats.css';
import type { JSX } from 'preact';
import { useEffect, useState } from 'preact/hooks';
import { t } from '@/shared/i18n';
import { Button, Notice } from '@/shared/ui';
import { EmptyState } from '@/shared/ui/empty-state';
import { defaultClock, navigate } from '@/shared/lib';
import { learnTargetMs, learnTrack } from '@/entities/settings';
import type { LearnTrack } from '@/entities/settings';
import { initLearn, learnStatus, learnView, localDay, retryLearn } from '@/entities/learn';
import { LearningSection } from './learning-section';
import { ProgressChart } from './progress-chart';
import { TrackSwitch } from './track-switch';

// Progress: the kana table of the shown track, then the statistics (design decisions 130, 137, 146).
export function ProgressPage(): JSX.Element {
  useEffect(() => {
    void initLearn(() => learnTargetMs.value);
  }, []);

  // The switch only chooses what this page shows: it starts at the learning track of `/` and never
  // writes it (P8 plan, Q4).
  const [track, setTrack] = useState<LearnTrack>(learnTrack.value);
  const status = learnStatus.value;
  const view = learnView.value;
  const has = view !== null && (view.stats.days.size > 0 || view.stats.started > 0);

  return (
    <section className="max-w-layout-max mx-auto flex w-full flex-col gap-8 sm:gap-12">
      <div className="flex flex-wrap items-center justify-between gap-x-6 gap-y-4">
        <h1 className="text-ui-title text-fur">{t('page.progress')}</h1>
        <TrackSwitch value={track} onChange={setTrack} />
      </div>
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
      {status === 'ready' && view !== null && (
        <>
          <ProgressChart view={view} track={track} now={defaultClock.now()} />
          {has ? (
            <LearningSection view={view} today={localDay(defaultClock.now())} track={track} />
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
          )}
        </>
      )}
    </section>
  );
}
