import type { JSX } from 'preact';
import { useState } from 'preact/hooks';
import { locale, t, tParts, tPlural } from '@/shared/i18n';
import { Parts, Segmented } from '@/shared/ui';
import { Stat } from '@/shared/ui/stat';
import { defaultClock, navigate } from '@/shared/lib';
import { learnTargetMs, learnTrack } from '@/entities/settings';
import type { LearnTrack } from '@/entities/settings';
import {
  dayStart,
  learnCounters,
  learnState,
  localDay,
  streaks,
  trackProgress,
} from '@/entities/learn';
import { medianAxis, medianSeries } from '../lib/median-series';
import { ResultChart } from './result-chart';
import { SectionEmpty } from './section-empty';

const MONO = 'text-mono-romaji text-fur font-mono';

function dateLabel(day: number): string {
  return new Intl.DateTimeFormat(locale.value, { day: 'numeric', month: 'short' }).format(
    dayStart(day),
  );
}

// The learning section: streaks, mastered kana, the answer time, the session counters. It is drawn
// once the learning state has loaded.
export function LearningSection(): JSX.Element {
  // The chart's switch is local: looking at the other track here does not change the track on `/`.
  const [chosen, setChosen] = useState<LearnTrack>(learnTrack.value);

  const target = learnTargetMs.value;
  const state = learnState.value;
  const counters = learnCounters.value;

  if (state.activeDays.length === 0 && counters.started.learn === 0) {
    return (
      <SectionEmpty
        title={t('stats.learn.empty.title')}
        text={t('stats.learn.empty.text')}
        action={t('stats.learn.empty.action')}
        onAction={() => {
          navigate('/');
        }}
      />
    );
  }

  const today = localDay(defaultClock.now());
  const { current, best } = streaks(state, today);
  const progress = {
    hiragana: trackProgress(state, 'hiragana', target),
    katakana: trackProgress(state, 'katakana', target),
  };
  const withMedians = {
    hiragana: progress.hiragana.medians.length > 0,
    katakana: progress.katakana.medians.length > 0,
  };
  const both = withMedians.hiragana && withMedians.katakana;
  // With one track that has answers, the chart shows it and there is nothing to switch.
  const track: LearnTrack = both
    ? chosen
    : withMedians.katakana
      ? 'katakana'
      : withMedians.hiragana
        ? 'hiragana'
        : chosen;
  const series = medianSeries(progress[track].medians, today);
  const axis = medianAxis(series.values, target);
  const hasPoints = series.values.some((value) => value !== null);
  const caption = t('stats.learn.answerCaption');

  return (
    <div className="flex flex-col gap-8 sm:gap-12">
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
        {(['hiragana', 'katakana'] as const).map((name) => (
          <Stat
            key={name}
            label={t('stats.learn.masteredTrack', { track: t(`learn.track.${name}`) })}
            value={progress[name].mastered}
            unit={t('stats.learn.masteredOf', { total: progress[name].total })}
          />
        ))}
      </div>

      <div className="flex max-w-[760px] flex-col gap-4">
        <h2 className="text-ui-heading text-fur">{t('stats.learn.answerTime')}</h2>
        <p className="text-ui-caption text-fur-dim">
          {both ? caption : `${t(`learn.track.${track}`)} · ${caption}`}
        </p>
        {both && (
          <div>
            <Segmented<LearnTrack>
              options={[
                { value: 'hiragana', label: t('learn.track.hiragana') },
                { value: 'katakana', label: t('learn.track.katakana') },
              ]}
              value={track}
              onChange={setChosen}
              ariaLabel={t('learn.track.label')}
            />
          </div>
        )}
        {hasPoints ? (
          <ResultChart
            key={track}
            testId="stats-median-chart"
            dots
            values={series.values}
            xLabels={series.days.map(dateLabel)}
            domain={axis.domain}
            ticks={axis.ticks}
            reference={{ value: target, label: t('stats.learn.target', { ms: target }) }}
            label={`${t('stats.learn.answerTime')} · ${caption}`}
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

      <p className="text-ui-label text-fur-dim" data-testid="stats-sessions">
        <Parts
          parts={tParts('stats.learn.sessions', {
            started: counters.started.learn,
            finished: counters.finished.learn,
          })}
          valueClass={MONO}
        />
      </p>
    </div>
  );
}
