import type { JSX } from 'preact';
import { useState } from 'preact/hooks';
import { locale, t, tParts, tPlural } from '@/shared/i18n';
import { Button, Notice, Parts, Segmented } from '@/shared/ui';
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
import { dayBars, msAxis } from '../lib/answer-time';
import type { Period } from '../lib/selection';
import { timeAxis, type ChartRange } from '../lib/trend';
import { SectionEmpty } from './section-empty';
import { StatsChart } from './stats-chart';
import { useNarrow } from './use-narrow';

const HALF_DAY_MS = 12 * 60 * 60 * 1000;
const DAY_MS = 2 * HALF_DAY_MS;
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
  const [period, setPeriod] = useState<Period>('30');
  const narrow = useNarrow();

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
  const days = state.recallBuckets[track];
  const { weekly, span, bars } = dayBars(days, period, today);
  const axis = msAxis(bars, target);
  const xAxis = timeAxis(period, dayStart(today - span + 1), today, narrow, (ms) =>
    dateLabel(localDay(ms)),
  );
  const [x0, x1] = xAxis.domain;
  const caption = t(weekly ? 'stats.learn.answerCaptionWeek' : 'stats.learn.answerCaptionDay');
  const ranges: ChartRange[] = bars.map((bar) => {
    // A week is drawn at its middle, kept inside the axis (the first week may start before it).
    const middle = dayStart(bar.day) + (weekly ? 3.5 * DAY_MS : HALF_DAY_MS);
    const date = dateLabel(bar.day);
    return {
      x: Math.min(x1 - HALF_DAY_MS, Math.max(x0 + HALF_DAY_MS, middle)),
      lo: bar.lo,
      hi: bar.hi,
      mid: bar.mid,
      tip: [
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

      <div className="flex max-w-[760px] flex-col gap-4">
        <h2 className="text-ui-heading text-fur">{t('stats.learn.answerTime')}</h2>
        <p className="text-ui-caption text-fur-dim">
          {both ? caption : `${t(`learn.track.${track}`)} · ${caption}`}
        </p>
        <div className="flex flex-wrap items-center gap-x-6 gap-y-4">
          {both && (
            <Segmented<LearnTrack>
              options={[
                { value: 'hiragana', label: t('learn.track.hiragana') },
                { value: 'katakana', label: t('learn.track.katakana') },
              ]}
              value={track}
              onChange={setChosen}
              ariaLabel={t('learn.track.label')}
            />
          )}
          <Segmented<Period>
            ariaLabel={t('stats.filter.period')}
            value={period}
            options={[
              { value: '7', label: t('stats.filter.p7') },
              { value: '30', label: t('stats.filter.p30') },
              { value: 'all', label: t('stats.filter.all') },
            ]}
            onChange={setPeriod}
          />
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
