import type { JSX } from 'preact';
import { useEffect } from 'preact/hooks';
import { t } from '@/shared/i18n';
import { Segmented } from '@/shared/ui';
import { defaultClock } from '@/shared/lib';
import { learnTargetMs, learnTrack, setTrack } from '@/entities/settings';
import type { LearnTrack } from '@/entities/settings';
import {
  initLearn,
  learnCounters,
  learnReady,
  learnState,
  localDay,
  streaks,
  trackProgress,
} from '@/entities/learn';
import { MedianChart } from './median-chart';

// Statistics. The learning section is built; the typing section comes with P4.
export function StatsPage(): JSX.Element {
  useEffect(() => {
    void initLearn(() => learnTargetMs.value);
  }, []);

  if (!learnReady.value) {
    return (
      <p role="status" className="text-fur-dim text-ui-label py-12 text-center">
        {t('route.loading')}
      </p>
    );
  }

  const track = learnTrack.value;
  const target = learnTargetMs.value;
  const state = learnState.value;
  const progress = trackProgress(state, track, target);
  const { current, best } = streaks(state, localDay(defaultClock.now()));
  const counters = learnCounters.value;

  return (
    <section className="max-w-layout-test mx-auto flex w-full flex-col items-start gap-6 py-12">
      <h1 className="text-ui-title text-fur">{t('page.stats')}</h1>
      <h2 className="text-ui-body text-fur">{t('stats.learn.title')}</h2>

      <Segmented<LearnTrack>
        options={[
          { value: 'hiragana', label: t('learn.track.hiragana') },
          { value: 'katakana', label: t('learn.track.katakana') },
        ]}
        value={track}
        onChange={setTrack}
        ariaLabel={t('learn.track.label')}
      />

      <div className="flex flex-col gap-1">
        <p className="text-fur text-ui-body" data-testid="stats-mastered">
          {t('stats.learn.mastered', { done: progress.mastered, total: progress.total })}
        </p>
        <p className="text-fur text-ui-body" data-testid="stats-streak-current">
          {t('stats.learn.streakCurrent', { days: current })}
        </p>
        <p className="text-fur text-ui-body" data-testid="stats-streak-best">
          {t('stats.learn.streakBest', { days: best })}
        </p>
        <p className="text-fur text-ui-body" data-testid="stats-sessions">
          {t('stats.learn.sessions', {
            finished: counters.finished.learn,
            started: counters.started.learn,
          })}
        </p>
      </div>

      <div className="flex w-full flex-col gap-2">
        <p className="text-fur text-ui-body">{t('stats.learn.median')}</p>
        <p className="text-fur-dim text-ui-label">{t('stats.learn.medianHint')}</p>
        {progress.medians.length === 0 ? (
          <p className="text-fur-dim text-ui-body" data-testid="stats-no-data">
            {t('stats.learn.noData')}
          </p>
        ) : (
          <MedianChart points={progress.medians} targetMs={target} />
        )}
      </div>
    </section>
  );
}
