import type { JSX } from 'preact';
import { useEffect, useState } from 'preact/hooks';
import { locale, t, tParts, tPlural } from '@/shared/i18n';
import { Button, Notice, Parts, Segmented } from '@/shared/ui';
import { EmptyState } from '@/shared/ui/empty-state';
import { Stat } from '@/shared/ui/stat';
import { defaultClock, navigate } from '@/shared/lib';
import { learnTargetMs, learnTrack } from '@/entities/settings';
import { initTyping, retryTyping, typingCounters, typingStatus } from '@/entities/stats';
import type { LearnTrack } from '@/entities/settings';
import {
  dayStart,
  initLearn,
  learnCounters,
  learnState,
  learnStatus,
  localDay,
  retryLearn,
  streaks,
  trackProgress,
} from '@/entities/learn';
import { medianAxis, medianSeries } from '../lib/median-series';
import { ResultChart } from './result-chart';
import { TypingSection } from './typing-section';

const MONO = 'text-mono-romaji text-fur font-mono';

function dateLabel(day: number): string {
  return new Intl.DateTimeFormat(locale.value, { day: 'numeric', month: 'short' }).format(
    dayStart(day),
  );
}

// Statistics: learning, typing, counters.
export function StatsPage(): JSX.Element {
  // The chart's switch is local: looking at the other track here does not change the track on `/`.
  const [track, setTrack] = useState<LearnTrack>(learnTrack.value);

  useEffect(() => {
    void initLearn(() => learnTargetMs.value);
    void initTyping();
  }, []);

  if (learnStatus.value === 'error' || typingStatus.value === 'error') {
    return (
      <section className="max-w-layout-max mx-auto flex w-full flex-col items-start gap-6 py-12">
        <Notice
          tone="miss"
          action={
            <Button
              variant="secondary"
              size="sm"
              onClick={() => {
                void retryLearn();
                void retryTyping();
              }}
            >
              {t('learn.retry')}
            </Button>
          }
        >
          {t('learn.loadError')}
        </Notice>
      </section>
    );
  }

  if (learnStatus.value !== 'ready' || typingStatus.value !== 'ready') {
    return (
      <p role="status" className="text-fur-dim text-ui-label py-12 text-center">
        {t('route.loading')}
      </p>
    );
  }

  const target = learnTargetMs.value;
  const state = learnState.value;
  const counters = learnCounters.value;
  const today = localDay(defaultClock.now());
  const { current, best } = streaks(state, today);
  const progress = {
    hiragana: trackProgress(state, 'hiragana', target),
    katakana: trackProgress(state, 'katakana', target),
  };
  const series = medianSeries(progress[track].medians, today);
  const axis = medianAxis(series.values, target);
  const typing = typingCounters.value;
  const answered = state.activeDays.length > 0 || counters.started.learn > 0;
  const typed = typing.started.typing > 0 || typing.finished.typing > 0;
  const heading = t('page.stats');

  if (!answered && !typed) {
    return (
      <section className="max-w-layout-max mx-auto flex w-full flex-col gap-12 py-12">
        <h1 className="text-ui-title text-fur">{heading}</h1>
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
      </section>
    );
  }

  const hasPoints = series.values.some((value) => value !== null);

  return (
    <section className="max-w-layout-max mx-auto flex w-full flex-col gap-12 py-12">
      <h1 className="text-ui-title text-fur">{heading}</h1>

      <section className="flex flex-col gap-8" aria-labelledby="stats-learning">
        <h2 id="stats-learning" className="text-ui-heading text-fur">
          {t('stats.learn.title')}
        </h2>

        <div className="flex flex-wrap gap-x-12 gap-y-8">
          <Stat
            label={t('stats.learn.streakCurrent')}
            value={current}
            unit={tPlural('stats.learn.days', current)}
          />
          <Stat
            label={t('stats.learn.streakBest')}
            value={best}
            unit={tPlural('stats.learn.days', best)}
          />
          <div className="flex flex-col gap-1">
            <div className="text-ui-caption text-fur-dim">{t('stats.learn.mastered')}</div>
            <div
              className="text-ui-body text-fur-dim flex flex-col gap-1"
              data-testid="stats-mastered"
            >
              {(['hiragana', 'katakana'] as const).map((name) => (
                <span key={name}>
                  <Parts
                    parts={tParts('stats.learn.trackProgress', {
                      track: t(`learn.track.${name}`),
                      done: progress[name].mastered,
                      total: progress[name].total,
                    })}
                    valueClass={MONO}
                  />
                </span>
              ))}
            </div>
          </div>
        </div>

        <div className="flex max-w-[760px] flex-col gap-4">
          <div className="flex flex-wrap items-end justify-between gap-3">
            <div className="flex flex-col gap-1">
              <h3 className="text-ui-label text-fur">{t('stats.learn.median')}</h3>
              <span className="text-ui-caption text-fur-dim">{t('stats.learn.medianHint')}</span>
            </div>
            <Segmented<LearnTrack>
              options={[
                { value: 'hiragana', label: t('learn.track.hiragana') },
                { value: 'katakana', label: t('learn.track.katakana') },
              ]}
              value={track}
              onChange={setTrack}
              ariaLabel={t('learn.track.label')}
            />
          </div>
          {hasPoints ? (
            <ResultChart
              key={track}
              testId="stats-median-chart"
              values={series.values}
              xLabels={series.days.map(dateLabel)}
              domain={axis.domain}
              ticks={axis.ticks}
              reference={{ value: target, label: t('stats.learn.target', { ms: target }) }}
              label={`${t('stats.learn.median')} · ${t('stats.learn.medianHint')}`}
              tip={(index, value) => {
                const date = dateLabel(series.days[index] ?? today);
                return value === null
                  ? t('stats.learn.tipNone', { date })
                  : t('stats.learn.tip', { date, ms: Math.round(value) });
              }}
            />
          ) : (
            <p className="text-fur-dim text-ui-body" data-testid="stats-no-data">
              {t('stats.learn.noData')}
            </p>
          )}
        </div>
      </section>

      <TypingSection />

      <section className="flex flex-col gap-4" aria-labelledby="stats-counters">
        <h2 id="stats-counters" className="text-ui-heading text-fur">
          {t('stats.counters.title')}
        </h2>
        <table className="w-full max-w-[480px] border-collapse" data-testid="stats-counters">
          <thead>
            <tr className="text-ui-caption text-fur-dim">
              <th className="pr-3 pb-2 text-left font-normal" />
              <th className="pr-3 pb-2 text-right font-normal">{t('stats.counters.started')}</th>
              <th className="pb-2 text-right font-normal">{t('stats.counters.finished')}</th>
            </tr>
          </thead>
          <tbody>
            <tr>
              <td className="text-ui-label text-fur py-1 pr-3">{t('stats.counters.typing')}</td>
              <td className={`${MONO} py-1 pr-3 text-right`} data-testid="stats-started-typing">
                {typing.started.typing}
              </td>
              <td className={`${MONO} py-1 text-right`} data-testid="stats-finished-typing">
                {typing.finished.typing}
              </td>
            </tr>
            <tr>
              <td className="text-ui-label text-fur py-1 pr-3">{t('stats.counters.learning')}</td>
              <td className={`${MONO} py-1 pr-3 text-right`} data-testid="stats-started">
                {counters.started.learn}
              </td>
              <td className={`${MONO} py-1 text-right`} data-testid="stats-finished">
                {counters.finished.learn}
              </td>
            </tr>
          </tbody>
        </table>
      </section>
    </section>
  );
}
