import type { JSX } from 'preact';
import { useMemo, useState } from 'preact/hooks';
import type { TestResult } from '@nekotype/shared/types';
import { locale, t, tParts, tPlural } from '@/shared/i18n';
import { Button, Notice, Parts } from '@/shared/ui';
import { Stat } from '@/shared/ui/stat';
import { navigate } from '@/shared/lib';
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
import { activityDays, weeksFor } from '../lib/activity';
import { dayBars, msAxis } from '../lib/answer-time';
import { DAY_MS, HALF_DAY_MS } from '../lib/days';
import type { Period } from '../lib/selection';
import { timeAxis, type ChartRange } from '../lib/trend';
import { ActivityMap } from './activity-map';
import { BLOCK } from './layout';
import { PeriodSwitch } from './period-switch';
import { SectionEmpty } from './section-empty';
import { StatsChart } from './stats-chart';
import { TrackSwitch } from './track-switch';
import { useNarrow } from './use-narrow';

const MAX_WEEKS_NARROW = 13;
const MONO = 'text-mono-romaji text-fur font-mono';

// The learning section: streaks, mastered kana, the activity, the answer time, the session counters. It is drawn
// once the learning state has loaded.
export function LearningSection({
  results,
  today,
}: {
  /** The typing results for the test marks; `null` while unread or when the read failed. */
  readonly results: readonly TestResult[] | null;
  /** The local day. */
  readonly today: number;
}): JSX.Element {
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
  const activity = activityDays(state, results ?? []);
  const firstDay = Math.min(...activity.keys());
  const weeks = Math.min(
    weeksFor(activity.size > 0 ? firstDay : null, today),
    narrow ? MAX_WEEKS_NARROW : Infinity,
  );
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

      <div className="flex flex-col gap-4">
        <h2 className="text-ui-heading text-fur">{t('stats.activity.title')}</h2>
        <p className="text-ui-caption text-fur-dim">
          {t('stats.activity.caption', { weeks: tPlural('stats.weeks', weeks) })}
        </p>
        <ActivityMap days={activity} today={today} weeks={weeks} />
      </div>

      <div className={`flex ${BLOCK} flex-col gap-4`}>
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
            points={[]}
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
