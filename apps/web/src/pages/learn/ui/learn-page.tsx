import type { JSX } from 'preact';
import { useCallback, useEffect, useRef, useState } from 'preact/hooks';
import { t } from '@/shared/i18n';
import { Button, Segmented } from '@/shared/ui';
import { KanaChart } from '@/shared/ui/kana-chart';
import { chartModel, kanaDetails } from '../lib/chart';
import { learnStrictness, learnTargetMs, learnTrack, setTrack } from '@/entities/settings';
import type { LearnTrack } from '@/entities/settings';
import { defaultClock, defaultRng, defaultScheduler } from '@/shared/lib';
import {
  cellInfos,
  currentStreak,
  initLearn,
  isMastered,
  keyOf,
  keysOfTrack,
  learnReady,
  learnState,
  localDay,
  introduce,
  recordRecall,
  recordRecognition,
  countSession,
} from '@/entities/learn';
import { createLearnSession } from '../model/session';
import type { LearnSession } from '../model/session';
import { silentAudio } from '../lib/audio';
import { SessionScreen } from './session-screen';
import { SummaryScreen } from './summary-screen';

type View = 'home' | 'session' | 'summary';

// The learning screen: track switch, progress, the kana chart and the learning session
// (docs/spec/learning.md, "`/` screen"). The hidden input field belongs to the page and keeps the
// focus through a session, so "Continue" can focus it inside its click (a phone keeps its keyboard).
export function LearnPage(): JSX.Element {
  const [view, setView] = useState<View>('home');
  const [session, setSession] = useState<LearnSession | null>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    void initLearn(() => learnTargetMs.value);
  }, []);

  const startSession = useCallback((): void => {
    inputRef.current?.focus();
    const next = createLearnSession({
      track: learnTrack.value,
      store: { state: learnState, introduce, recordRecall, recordRecognition, countSession },
      clock: defaultClock,
      scheduler: defaultScheduler,
      rng: defaultRng,
      audio: silentAudio,
      strictness: () => learnStrictness.value,
      targetMs: () => learnTargetMs.value,
    });
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
  if (view === 'session' && session !== null) {
    return (
      <>
        {hiddenInput}
        <SessionScreen
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
        <SummaryScreen summary={summary} onContinue={startSession} onTable={toTable} />
      </>
    );
  }

  const track = learnTrack.value;
  const state = learnState.value;
  const keys = keysOfTrack(track);
  const target = learnTargetMs.value;
  const mastered = keys.filter((key) =>
    isMastered(state.entries[key], state.recent[key] ?? [], target),
  ).length;
  const now = defaultClock.now();
  const infos = cellInfos(track, state, target, now);
  const streak = currentStreak(state.activeDays, localDay(now));

  return (
    <>
      {hiddenInput}
      <section className="max-w-layout-test mx-auto flex w-full flex-col items-start gap-6 py-12">
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

        <Button variant="primary" size="lg" onClick={startSession}>
          {t('learn.continue')}
        </Button>

        <KanaChart
          rows={chartModel(track, infos)}
          ariaLabel={t('learn.chart.label')}
          renderDetails={(cell, close) => {
            const info = infos.get(keyOf(track, cell.kana));
            if (info === undefined) return null;
            return (
              <div className="flex flex-col items-start gap-1">
                {kanaDetails(info).map((line) => (
                  <p key={line}>{line}</p>
                ))}
                <Button variant="text" size="sm" onClick={close}>
                  {t('learn.chart.close')}
                </Button>
              </div>
            );
          }}
        />
      </section>
    </>
  );
}
