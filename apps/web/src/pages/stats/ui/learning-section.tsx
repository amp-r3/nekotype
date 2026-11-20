import type { JSX } from 'preact';
import { useMemo, useState } from 'preact/hooks';
import { locale, t, tParts, tPlural } from '@/shared/i18n';
import { Button, Notice, Parts } from '@/shared/ui';
import { Stat } from '@/shared/ui/stat';
import { learnTargetMs, learnTrack } from '@/entities/settings';
import type { LearnTrack } from '@/entities/settings';
import {
  dayStart,
  hasAnswers,
  learnCounters,
  learnState,
  streaks,
  trackProgress,
} from '@/entities/learn';
import { activeDaysIn, activityDays } from '../lib/activity';
import { dayBars, msAxis } from '../lib/answer-time';
import { DAY_MS, HALF_DAY_MS } from '../lib/days';
import type { Period } from '../lib/days';
import { timeAxis, type ChartRange } from '../lib/trend';
import { ActivityMap } from './activity-map';
import { PeriodSwitch } from './period-switch';
import { StatsChart } from './stats-chart';
import { TrackSwitch } from './track-switch';
import { useNarrow } from './use-narrow';

const MONO = 'text-mono-romaji text-fur font-mono';
/** The window of the active days count: fixed, so the number never depends on the map's width. */
const ACTIVE_WINDOW = 30;

// The learning section, the whole of `/stats` (design decision 137): the streak next to the
// activity map, the totals, the answer time; four equal columns, two below 640 px. It is drawn
// once the learning state has loaded and holds data.
export function LearningSection({ today }: { readonly today: number }): JSX.Element {
  // The chart's switch is local: looking at the other track here does not change the track on `/`.
  const [chosen, setChosen] = useState<LearnTrack>(learnTrack.value);
  const [period, setPeriod] = useState<Period>('30');
  const narrow = useNarrow();
  const dateFormat = useMemo(
    () => new Intl.DateTimeFormat(locale.value, { day: 'numeric', month: 'short' }),
    [locale.value],
  );

  const target = learnTargetMs.value;
  const state = learnState.value;
  const counters = learnCounters.value;

  const { current, best } = streaks(state, today);
  const progress = {
    hiragana: trackProgress(state, 'hiragana', target),
    katakana: trackProgress(state, 'katakana', target),
  };
  const withMedians = {
    hiragana: hasAnswers(state.recallBuckets.hiragana),
    katakana: hasAnswers(state.recallBuckets.katakana),
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
  const activity = activityDays(state, today);
  const days = state.recallBuckets[track];
  const { weekly, span, bars } = dayBars(days, period, today);
  const axis = msAxis(bars, target);
  const xAxis = timeAxis(period, dayStart(today - span + 1), today, narrow, (ms) =>
    dateFormat.format(ms),
  );
  const [x0, x1] = xAxis.domain;
  const caption = t(weekly ? 'stats.learn.answerCaptionWeek' : 'stats.learn.answerCaptionDay');
  const ranges: ChartRange[] = bars.map((bar) => {
    // A week is drawn at its middle, kept inside the axis (the first week may start before it).
    const middle = dayStart(bar.day) + (weekly ? 3.5 * DAY_MS : HALF_DAY_MS);
    const date = dateFormat.format(dayStart(bar.day));
    return {
      x: Math.min(x1 - HALF_DAY_MS, Math.max(x0 + HALF_DAY_MS, middle)),
      lo: bar.lo,
      hi: bar.hi,
      mid: bar.mid,
      tip: () => [
        weekly ? t('stats.learn.weekOf', { date }) : date,
        t('stats.learn.tip.median', {
          ms: Math.round(bar.mid),
          answers: tPlural('stats.answers', bar.answers),
        }),
        t('stats.learn.tip.half', { lo: Math.round(bar.lo), hi: Math.round(bar.hi) }),
      ],
    };
  });

  return (
    <div className="grid grid-cols-2 gap-x-12 gap-y-8 sm:grid-cols-4 sm:gap-y-12">
      <div className="col-span-2 flex flex-col gap-4 sm:col-span-4">
        <h2 className="text-ui-heading text-fur">{t('stats.streak.title')}</h2>
        <p className="text-ui-caption text-fur-dim">{t('stats.streak.caption')}</p>
      </div>

      <div className="col-span-2 flex items-center gap-x-8 max-sm:justify-between sm:col-span-1 sm:flex-col sm:items-start sm:gap-y-4">
        <div className="flex flex-col gap-1">
          <div className="text-ui-caption text-fur-dim">{t('stats.learn.streakCurrent')}</div>
          <div
            className="text-fur text-mono-hero-sm sm:text-mono-hero font-mono tabular-nums"
            data-testid="stats-streak"
          >
            {current}
          </div>
          <div className="text-ui-label text-fur-dim">{t('stats.learn.daysInRow')}</div>
        </div>
        <div className="text-ui-label text-fur-dim flex flex-col gap-1">
          <p>
            <Parts
              parts={tParts('stats.learn.streakBest', {
                days: `${best} ${tPlural('stats.learn.days', best)}`,
              })}
              valueClass={MONO}
            />
          </p>
          <p data-testid="stats-active-30">
            <Parts
              parts={tParts('stats.learn.active30', {
                count: activeDaysIn(state, today, ACTIVE_WINDOW),
              })}
              valueClass={MONO}
            />
          </p>
        </div>
      </div>
      <div className="col-span-2 min-w-0 sm:col-span-3">
        <ActivityMap days={activity} today={today} />
      </div>

      {(['hiragana', 'katakana'] as const).map((name) => (
        <Stat
          key={name}
          label={t('stats.learn.masteredTrack', { track: t(`learn.track.${name}`) })}
          value={progress[name].mastered}
          unit={t('stats.learn.masteredOf', { total: progress[name].total })}
        />
      ))}
      <Stat
        label={t('stats.learn.sessionsStarted')}
        value={counters.started}
        testId="stats-started"
      />
      <Stat
        label={t('stats.learn.sessionsFinished')}
        value={counters.finished}
        testId="stats-finished"
      />

      <div className="col-span-2 flex flex-col gap-4 sm:col-span-4">
        <h2 className="text-ui-heading text-fur">{t('stats.learn.answerTime')}</h2>
        <p className="text-ui-caption text-fur-dim">
          {both ? caption : `${t(`learn.track.${track}`)} · ${caption}`}
        </p>
        <div className="flex flex-wrap items-center gap-x-6 gap-y-4">
          {both && <TrackSwitch value={track} onChange={setChosen} />}
          <PeriodSwitch value={period} onChange={setPeriod} />
        </div>
        {bars.length > 0 ? (
          <StatsChart
            key={track}
            testId="stats-median-chart"
            ranges={ranges}
            slots={weekly ? Math.ceil(span / 7) : span}
            xDomain={xAxis.domain}
            xTicks={xAxis.ticks}
            yDomain={axis.domain}
            yTicks={axis.ticks}
            reference={{ value: target, label: t('stats.learn.target', { ms: target }) }}
            height={narrow ? 200 : 240}
            label={`${t('stats.learn.answerTime')} · ${caption}`}
          />
        ) : (
          <Notice
            action={
              period === 'all' ? undefined : (
                <Button
                  variant="secondary"
                  size="sm"
                  onClick={() => {
                    setPeriod('all');
                  }}
                >
                  {t('stats.showAll')}
                </Button>
              )
            }
          >
            {t('stats.learn.noPeriod')}
          </Notice>
        )}
      </div>
    </div>
  );
}
