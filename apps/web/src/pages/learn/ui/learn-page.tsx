import type { JSX } from 'preact';
import { useCallback, useEffect, useRef, useState } from 'preact/hooks';
import { t, tParts, tPluralParts } from '@/shared/i18n';
import { Button, Notice, Parts, Segmented } from '@/shared/ui';
import { KanaChart } from '@/shared/ui/kana-chart';
import { openKanaDetails } from '@/features/kana-details';
import { chartBlockLabels, chartLegend, chartModel } from '../lib/chart';
import { learnTargetMs, learnTrack, setTrack } from '@/entities/settings';
import type { LearnTrack } from '@/entities/settings';
import { databaseMode, defaultClock } from '@/shared/lib';
import {
  cellInfos,
  dueCount,
  initLearn,
  keyOf,
  keysOfTrack,
  learnStatus,
  learnView,
  localDay,
  retryLearn,
  streakOfDays,
} from '@/entities/learn';
import { authError, signInCheck } from '@/entities/user';
import type { LearnSession } from '../model/session';
import { loadSessionRuntime } from '../session-loader';
import type { SessionRuntime } from '../session-loader';

type View = 'home' | 'loading' | 'session' | 'summary';

const kanaOfKey = (key: string): string => key.slice(key.indexOf(':') + 1);

// The learning screen: track switch, progress, the kana chart and the learning session
// (docs/spec/learning.md, "`/` screen"). The hidden input field belongs to the page and keeps the
// focus through a session, so "Continue" can focus it inside its click (a phone keeps its keyboard).
export function LearnPage(): JSX.Element {
  const [view, setView] = useState<View>('home');
  const [session, setSession] = useState<LearnSession | null>(null);
  const [runtime, setRuntime] = useState<SessionRuntime | null>(null);
  const [loadFailed, setLoadFailed] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);
  const actionsRef = useRef<HTMLDivElement>(null);
  // Until a returning sign-in is settled nothing of either account is shown (design decision 118).
  const status = signInCheck.value === 'idle' ? learnStatus.value : 'loading';

  useEffect(() => {
    void initLearn(() => learnTargetMs.value);
  }, []);

  // `continue` takes the focus when the screen is ready, so Enter starts the session (design 32).
  useEffect(() => {
    if (status !== 'ready' || view !== 'home') return;
    actionsRef.current?.querySelector('button')?.focus({ preventScroll: true });
  }, [status, view]);

  // The session code is a chunk of its own. The field is focused here, inside the click, before
  // the chunk is awaited, so a phone keeps its keyboard.
  const startSession = useCallback(async () => {
    inputRef.current?.focus();
    setLoadFailed(false);
    setView('loading');
    const loaded = await loadSessionRuntime();
    if (loaded === null) {
      setLoadFailed(true);
      setView('home');
      return;
    }
    const next = loaded.openSession();
    setRuntime(loaded);
    setSession(next);
    setView('session');
    next.start();
  }, []);

  const toTable = useCallback((): void => {
    session?.leave();
    setView('home');
  }, [session]);

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
      tabIndex={-1}
      aria-hidden={view === 'home' ? 'true' : undefined}
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
  if (view === 'summary' && summary !== null && runtime !== null) {
    return (
      <>
        {hiddenInput}
        <runtime.SummaryScreen
          summary={summary}
          onContinue={() => {
            void startSession();
          }}
          onTable={toTable}
          inputRef={inputRef}
        />
      </>
    );
  }

  const ready = status === 'ready';
  const track = learnTrack.value;
  const learned = learnView.value;
  const keys = keysOfTrack(track);
  const now = defaultClock.now();
  const infos = learned === null ? null : cellInfos(track, learned, now);
  const mastered = learned?.mastered[track] ?? 0;
  const due = learned === null ? 0 : dueCount(learned, now);
  const streak = learned === null ? 0 : streakOfDays(learned.stats.days, localDay(now));
  // The streak and the first-visit line depend on the first answer, from any track.
  const answered = learned !== null && learned.stats.days.size > 0;
  const vowels = keys.slice(0, 5).map(kanaOfKey).join(' ');

  // One reserved line: what holds the screen back, most serious first.
  const notice =
    status === 'error'
      ? { text: t('learn.loadError'), miss: true, retry: true }
      : loadFailed
        ? { text: t('route.loadError'), miss: true, retry: false }
        : status === 'loading'
          ? { text: t('learn.loading'), miss: false, retry: false }
          : databaseMode.value === 'memory'
            ? { text: t('learn.storage'), miss: false, retry: false }
            : authError.value === 'denied'
              ? { text: t('learn.authDenied'), miss: false, retry: false }
              : authError.value === 'failed'
                ? { text: t('learn.authFailed'), miss: true, retry: false }
                : null;

  return (
    <>
      {hiddenInput}
      <section className="max-w-layout-max mx-auto flex w-full flex-col items-start gap-6">
        <h1 className="sr-only">{t('page.learn')}</h1>

        <div className="flex w-full flex-wrap items-baseline justify-between gap-x-8 gap-y-3">
          <Segmented<LearnTrack>
            options={[
              { value: 'hiragana', label: t('learn.track.hiragana') },
              { value: 'katakana', label: t('learn.track.katakana') },
            ]}
            value={track}
            onChange={setTrack}
            ariaLabel={t('learn.track.label')}
          />

          {/* The line keeps its height while loading, so the buttons do not jump. Below 640 px the
              two lines stack under the switch, without the separator. */}
          {status !== 'error' && (
            <p
              className={`text-fur-dim text-ui-body max-sm:flex max-sm:flex-col max-sm:gap-1 ${ready ? '' : 'invisible'}`}
            >
              <span data-testid="learn-mastered-count">
                <Parts
                  parts={tParts('learn.mastered', { done: mastered, total: keys.length })}
                  valueClass="text-mono-romaji text-fur font-mono"
                />
              </span>
              {answered && (
                <>
                  <span aria-hidden="true" className="max-sm:hidden">
                    {' · '}
                  </span>
                  <span data-testid="learn-streak">
                    <Parts
                      parts={tPluralParts('learn.streak', streak)}
                      valueClass="text-mono-romaji text-fur font-mono"
                    />
                  </span>
                </>
              )}
              {due > 0 && (
                <>
                  <span aria-hidden="true" className="max-sm:hidden">
                    {' · '}
                  </span>
                  <span data-testid="learn-due">
                    <Parts
                      parts={tParts('learn.due', { n: due })}
                      valueClass="text-mono-romaji text-fur font-mono"
                    />
                  </span>
                </>
              )}
            </p>
          )}
        </div>

        {ready && !answered && (
          <p className="text-fur-dim text-ui-body -mb-2" data-testid="learn-first">
            {/* The line may wrap; the kana never split across lines. */}
            <Parts
              parts={tParts('learn.first', { kana: vowels })}
              valueClass="font-jp text-jp-body text-fur whitespace-nowrap [word-spacing:0.15em]"
              lang="ja"
            />
          </p>
        )}

        <div ref={actionsRef} className="flex flex-wrap items-center gap-2">
          <Button
            variant="primary"
            size="lg"
            disabled={!ready}
            onClick={() => {
              void startSession();
            }}
          >
            {t('learn.continue')}
          </Button>
        </div>

        <Notice
          reserve
          loading={status === 'loading'}
          tone={notice?.miss === true ? 'miss' : undefined}
          action={
            notice?.retry === true ? (
              <Button
                variant="secondary"
                size="sm"
                onClick={() => {
                  void retryLearn();
                }}
              >
                {t('learn.retry')}
              </Button>
            ) : undefined
          }
        >
          {notice?.text}
        </Notice>

        {ready && infos !== null && (
          <div className="mt-2 w-full">
            <KanaChart
              rows={chartModel(track, infos)}
              ariaLabel={t('learn.chart.label')}
              blockLabels={chartBlockLabels()}
              legend={chartLegend(track)}
              onOpen={(cell) => {
                openKanaDetails(keyOf(track, cell.kana));
              }}
            />
          </div>
        )}
      </section>
    </>
  );
}
