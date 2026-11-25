import type { JSX } from 'preact';
import { useCallback, useEffect, useRef, useState } from 'preact/hooks';
import { t } from '@/shared/i18n';
import { learnTargetMs } from '@/entities/settings';
import { initLearn } from '@/entities/learn';
import type { LearnSession } from '../model/session';
import type { SummaryModel } from '../model/summary';
import { loadSessionRuntime } from '../session-loader';
import type { SessionRuntime } from '../session-loader';
import { HomeScreen } from './home/home-screen';

type View = 'home' | 'loading' | 'session' | 'summary';

// The learning screen: the home, the learning session and its summary (docs/spec/learning.md,
// "`/` screen"). The hidden input field belongs to the page and keeps the
// focus through a session, so "Continue" can focus it inside its click (a phone keeps its keyboard).
export function LearnPage(): JSX.Element {
  const [view, setView] = useState<View>('home');
  const [session, setSession] = useState<LearnSession | null>(null);
  const [runtime, setRuntime] = useState<SessionRuntime | null>(null);
  const [summaryModel, setSummaryModel] = useState<SummaryModel | null>(null);
  const [loadFailed, setLoadFailed] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    void initLearn(() => learnTargetMs.value);
  }, []);

  // The summary's model lives while the summary is shown: it asks for the insights at every
  // publish of the learn view. It ends synchronously where the summary is left (an effect's
  // cleanup runs after paint, too late: the `start` event of the next session publishes a view),
  // and here when the page goes.
  const summaryRef = useRef<SummaryModel | null>(null);
  summaryRef.current = summaryModel;
  const endSummary = useCallback((): void => {
    summaryRef.current?.dispose();
    summaryRef.current = null;
    setSummaryModel(null);
  }, []);
  useEffect(
    () => () => {
      summaryRef.current?.dispose();
    },
    [],
  );

  // The session code is a chunk of its own. The field is focused here, inside the click, before
  // the chunk is awaited, so a phone keeps its keyboard.
  const startSession = useCallback(async () => {
    inputRef.current?.focus();
    endSummary();
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
  }, [endSummary]);

  const toHome = useCallback((): void => {
    session?.leave();
    endSummary();
    setView('home');
  }, [session, endSummary]);

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
          onLeave={toHome}
          onEnd={() => {
            const model = runtime.openSummaryModel(session);
            summaryRef.current = model;
            setSummaryModel(model);
            setView('summary');
          }}
        />
      </>
    );
  }

  const summary = session?.summary.value ?? null;
  if (
    view === 'summary' &&
    session !== null &&
    summary !== null &&
    runtime !== null &&
    summaryModel !== null
  ) {
    return (
      <>
        {hiddenInput}
        <runtime.SummaryScreen
          summary={summary}
          model={summaryModel}
          track={session.track}
          onContinue={() => {
            // Nothing to do: the model offers no task, so a session would end empty (D2).
            if (summaryModel.canStart.peek()) void startSession();
          }}
          onHome={toHome}
          inputRef={inputRef}
        />
      </>
    );
  }

  return (
    <>
      {hiddenInput}
      <HomeScreen
        loadFailed={loadFailed}
        onStart={() => {
          void startSession();
        }}
      />
    </>
  );
}
