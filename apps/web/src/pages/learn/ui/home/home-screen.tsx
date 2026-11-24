import type { JSX } from 'preact';
import { useEffect, useRef, useState } from 'preact/hooks';
import { computed } from '@preact/signals';
import { t, tPluralParts } from '@/shared/i18n';
import { Button, Notice, Parts, Segmented } from '@/shared/ui';
import { databaseMode, defaultClock, defaultScheduler } from '@/shared/lib';
import { learnTrack, setTrack } from '@/entities/settings';
import type { LearnTrack } from '@/entities/settings';
import {
  insights,
  learnStatus,
  learnView,
  reasonAt,
  requestInsights,
  retryLearn,
} from '@/entities/learn';
import { authError, signInCheck } from '@/entities/user';
import { openKanaDetails } from '@/features/kana-details';
import { createHomeModel } from '../../model/home';
import type { HomeModel } from '../../model/home';
import { HomeAction } from './home-action';
import { loadHomePanels } from '../../home-loader';
import type { HomePanels } from '../../home-loader';

// Until a returning sign-in is settled nothing of either account is shown (design decision 118).
const ready = computed(() => signInCheck.value === 'idle' && learnStatus.value === 'ready');

function newModel(): HomeModel {
  return createHomeModel({
    track: learnTrack,
    view: learnView,
    ready,
    reasonAt,
    requestInsights,
    clock: defaultClock,
    scheduler: defaultScheduler,
    visibility: {
      onVisible: (listener) => {
        const onChange = (): void => {
          if (document.visibilityState === 'visible') listener();
        };
        document.addEventListener('visibilitychange', onChange);
        return () => {
          document.removeEventListener('visibilitychange', onChange);
        };
      },
    },
  });
}

export type HomeScreenProps = {
  /** The session code failed to load. */
  readonly loadFailed: boolean;
  /** Starts a learning session; the home calls it only when there is something to do. */
  readonly onStart: () => void;
};

// The learning home, `/` (docs/spec/learning.md, "`/` screen"; design decisions 140–145): what the
// next session does and why, the path and its forecast, and what got stronger since the last one.
// It exists only while the home is shown: its page model plans and asks for the insights, and
// nothing of that runs during a session.
export function HomeScreen({ loadFailed, onStart }: HomeScreenProps): JSX.Element {
  const [model, setModel] = useState<HomeModel | null>(null);
  const [panels, setPanels] = useState<HomePanels | null>(null);
  const continueRef = useRef<HTMLButtonElement>(null);
  const suggestRef = useRef<HTMLButtonElement>(null);

  useEffect(() => {
    const created = newModel();
    setModel(created);
    return () => {
      created.dispose();
    };
  }, []);

  // The path, the forecast and "since the last session" are a chunk of their own: they come while
  // the model loads, and a failed load leaves their places empty (the next visit tries again).
  useEffect(() => {
    void loadHomePanels().then(setPanels, () => undefined);
  }, []);

  const status = signInCheck.value === 'idle' ? learnStatus.value : 'loading';
  const track = learnTrack.value;
  const view = learnView.value;
  const reason = model?.reason.value ?? null;
  const canStart = model?.canStart.value ?? false;
  const mine = insights.value?.track === track ? insights.value : null;

  // `continue` takes the focus when the screen is ready, so Enter starts the session (design 32);
  // with nothing to do the katakana suggestion, now the primary action, takes it.
  const suggest = model?.suggestKatakana.value ?? false;
  const focusTarget =
    reason === null ? 'wait' : reason.kind === 'none' && suggest ? 'suggest' : 'continue';
  useEffect(() => {
    if (focusTarget === 'wait') return;
    (continueRef.current ?? suggestRef.current)?.focus({ preventScroll: true });
  }, [focusTarget]);

  const streak = model?.streak.value ?? null;

  const start = (): void => {
    if (model?.canStart.peek() === true) onStart();
  };

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
    <section className="max-w-layout-max mx-auto flex w-full flex-col gap-8">
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
        {streak !== null && (
          <p className="text-fur-dim text-ui-body" data-testid="learn-streak">
            <Parts
              parts={tPluralParts('learn.streak', streak)}
              valueClass="text-mono-romaji text-fur font-mono"
            />
          </p>
        )}
      </div>

      <div className="nk-home">
        <div className="nk-home__act flex flex-col gap-4">
          <HomeAction
            reason={reason}
            outline={mine?.outline ?? null}
            track={track}
            canStart={canStart}
            suggest={suggest}
            now={defaultClock.now()}
            onStart={start}
            onSuggest={() => {
              setTrack('katakana');
            }}
            continueRef={continueRef}
            suggestRef={suggestRef}
          />
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
        </div>

        <section className="nk-home__path flex flex-col gap-4" aria-labelledby="home-path-title">
          <h2 id="home-path-title" className="text-ui-heading text-fur">
            {t('learn.path.title', { track: t(`learn.track.${track}`) })}
          </h2>
          {view !== null && panels !== null && (
            <>
              <panels.HomeForecast state={mine?.forecast ?? { kind: 'pending' }} track={track} />
              <panels.HomePath view={view} track={track} />
            </>
          )}
        </section>

        {view !== null && panels !== null && model?.first.value === false && (
          <div className="nk-home__since">
            <panels.HomeSince
              state={mine?.stronger ?? { kind: 'pending' }}
              onOpen={openKanaDetails}
            />
          </div>
        )}
      </div>
    </section>
  );
}
