import type { JSX } from 'preact';
import { useCallback, useEffect, useRef, useState } from 'preact/hooks';
import { t } from '@/shared/i18n';
import { Button, Segmented } from '@/shared/ui';
import { KanaChart, KanaChartPanel } from '@/shared/ui/kana-chart';
import { chartBlockLabels, chartLegend, chartModel, kanaPanelLines, romajiOf } from '../lib/chart';
import { learnTargetMs, learnTrack, setTrack } from '@/entities/settings';
import type { LearnTrack } from '@/entities/settings';
import { defaultClock } from '@/shared/lib';
import {
  cellInfos,
  currentStreak,
  initLearn,
  masteredCount,
  keyOf,
  keysOfTrack,
  learnReady,
  learnState,
  localDay,
} from '@/entities/learn';
import type { LearnSession } from '../model/session';
import { dueCount } from '../lib/review-queue';
import { loadSessionRuntime } from '../session-loader';
import type { SessionRuntime } from '../session-loader';
import { SummaryScreen } from './summary-screen';

type View = 'home' | 'loading' | 'session' | 'summary';

// The learning screen: track switch, progress, the kana chart and the learning session
// (docs/spec/learning.md, "`/` screen"). The hidden input field belongs to the page and keeps the
// focus through a session, so "Continue" can focus it inside its click (a phone keeps its keyboard).
export function LearnPage(): JSX.Element {
  const [view, setView] = useState<View>('home');
  const [session, setSession] = useState<LearnSession | null>(null);
  const [runtime, setRuntime] = useState<SessionRuntime | null>(null);
  const [loadFailed, setLoadFailed] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    void initLearn(() => learnTargetMs.value);
  }, []);

  // The session code is a chunk of its own. The field is focused here, inside the click, before
  // the chunk is awaited, so a phone keeps its keyboard.
  const startSession = useCallback(async (mode: 'learning' | 'review' = 'learning') => {
    inputRef.current?.focus();
    setLoadFailed(false);
    setView('loading');
    const loaded = await loadSessionRuntime();
    if (loaded === null) {
      setLoadFailed(true);
      setView('home');
      return;
    }
    const next = loaded.openSession(mode);
    setRuntime(loaded);
    setSession(next);
    setView('session');
    next.start();
  }, []);

  const toTable = useCallback((): void => {
    session?.leave();
    setView('home');
  }, [session]);

  if (!learnReady.value) {
    return (
      <p role="status" className="text-fur-dim text-ui-label py-12 text-center">
        {t('route.loading')}
      </p>
    );
  }

  const hiddenInput = (
    <input
      ref={inputRef}
      type="text"
      autoComplete="off"
      autoCapitalize="off"
      autoCorrect="off"
      spellcheck={false}
      lang="en"
      aria-label={t('learn.session.input')}
      className="sr-only"
    />
  );

  // The field is the first child in every view, so it stays mounted and keeps the focus.
  if (view === 'loading') {
    return (
      <>
        {hiddenInput}
        <p role="status" className="text-fur-dim text-ui-label py-12 text-center">
          {t('route.loading')}
        </p>
      </>
    );
  }

  if (view === 'session' && session !== null && runtime !== null) {
    return (
      <>
        {hiddenInput}
        <runtime.SessionScreen
          session={session}
          inputRef={inputRef}
          onLeave={toTable}
          onEnd={() => {
            setView('summary');
          }}
        />
      </>
    );
  }

  const summary = session?.summary.value ?? null;
  if (view === 'summary' && summary !== null) {
    return (
      <>
        {hiddenInput}
        <SummaryScreen
          summary={summary}
          onContinue={() => {
            void startSession();
          }}
          onTable={toTable}
        />
      </>
    );
  }

  const track = learnTrack.value;
  const state = learnState.value;
  const keys = keysOfTrack(track);
  const target = learnTargetMs.value;
  const mastered = masteredCount(state, track, target);
  const now = defaultClock.now();
  const infos = cellInfos(track, state, target, now);
  const due = dueCount(state, track, target, now);
  const streak = currentStreak(state.activeDays, localDay(now));

  return (
    <>
      {hiddenInput}
      <section className="max-w-layout-max mx-auto flex w-full flex-col items-start gap-6 py-12">
        <h1 className="text-ui-title text-fur">{t('page.learn')}</h1>

        <Segmented<LearnTrack>
          options={[
            { value: 'hiragana', label: t('learn.track.hiragana') },
            { value: 'katakana', label: t('learn.track.katakana') },
          ]}
          value={track}
          onChange={setTrack}
          ariaLabel={t('learn.track.label')}
        />

        <p className="text-fur text-ui-body" data-testid="learn-mastered-count">
          {t('learn.mastered', { done: mastered, total: keys.length })}
        </p>

        <p className="text-fur text-ui-body" data-testid="learn-streak">
          {t('learn.streak', { days: streak })}
        </p>

        <div className="flex flex-wrap items-center gap-3">
          <Button
            variant="primary"
            size="lg"
            onClick={() => {
              void startSession();
            }}
          >
            {t('learn.continue')}
          </Button>
          <Button
            variant="secondary"
            size="lg"
            disabled={due === 0}
            onClick={() => {
              void startSession('review');
            }}
          >
            {t('learn.review', { n: due })}
          </Button>
        </div>

        {loadFailed && (
          <p role="alert" className="text-miss text-ui-body">
            {t('route.loadError')}
          </p>
        )}

        <KanaChart
          rows={chartModel(track, infos)}
          ariaLabel={t('learn.chart.label')}
          blockLabels={chartBlockLabels()}
          legend={chartLegend(track)}
          renderDetails={(cell, close) => {
            const info = infos.get(keyOf(track, cell.kana));
            if (info === undefined) return null;
            return (
              <KanaChartPanel
                kana={info.kana}
                romaji={romajiOf(info.key)}
                lines={kanaPanelLines(info)}
                closeLabel={t('learn.chart.close')}
                onClose={close}
              />
            );
          }}
        />
      </section>
    </>
  );
}
