import './stats.css';
import type { JSX } from 'preact';
import { useEffect, useState } from 'preact/hooks';
import { t } from '@/shared/i18n';
import { Button, Notice, Segmented } from '@/shared/ui';
import { EmptyState } from '@/shared/ui/empty-state';
import { navigate } from '@/shared/lib';
import { learnTargetMs } from '@/entities/settings';
import {
  initTyping,
  readAllResults,
  retryTyping,
  typingCounters,
  typingStatus,
} from '@/entities/stats';
import type { TestResult } from '@nekotype/shared/types';
import { initLearn, learnCounters, learnState, learnStatus, retryLearn } from '@/entities/learn';
import { initialSection, parseSection } from '../lib/section';
import type { Section } from '../lib/section';
import { LearningSection } from './learning-section';
import { TypingSection } from './typing-section';

type Status = 'loading' | 'ready' | 'error';

// A section's place under the switch: its loading text or its error with a retry.
function Pending({
  status,
  onRetry,
}: {
  readonly status: Status;
  readonly onRetry: () => void;
}): JSX.Element {
  if (status === 'error') {
    return (
      <Notice
        tone="miss"
        action={
          <Button variant="secondary" size="sm" onClick={onRetry}>
            {t('learn.retry')}
          </Button>
        }
      >
        {t('learn.loadError')}
      </Notice>
    );
  }
  return <Notice loading>{t('route.loading')}</Notice>;
}

// Statistics: one section at a time, `learning` or `typing`; the section is in the URL hash (S10).
export function StatsPage(): JSX.Element {
  const [chosen, setChosen] = useState<Section | null>(() => parseSection(window.location.hash));

  const [results, setResults] = useState<readonly TestResult[] | null>(null);
  const [failed, setFailed] = useState(false);
  const [attempt, setAttempt] = useState(0);
  const finished = typingCounters.value.finished.typing;

  // The whole history is read once and shared by both sections; a test saved in another tab
  // changes the counter and reads it again (S2). A failed read only costs the test marks.
  useEffect(() => {
    if (finished === 0) return undefined;
    let current = true;
    void readAllResults().then(
      (loaded) => {
        if (!current) return;
        setResults(loaded);
        setFailed(false);
      },
      () => {
        if (current) setFailed(true);
      },
    );
    return () => {
      current = false;
    };
  }, [finished, attempt]);

  useEffect(() => {
    void initLearn(() => learnTargetMs.value);
    void initTyping();
  }, []);

  // A hand-edited hash moves the switch; `replaceState` below does not fire this event.
  useEffect(() => {
    const onHashChange = (): void => {
      const next = parseSection(window.location.hash);
      if (next !== null) setChosen(next);
    };
    window.addEventListener('hashchange', onHashChange);
    return () => {
      window.removeEventListener('hashchange', onHashChange);
    };
  }, []);

  const learning = learnStatus.value;
  const typing = typingStatus.value;
  const has = {
    learning:
      learning === 'ready' &&
      (learnState.value.activeDays.length > 0 || learnCounters.value.started.learn > 0),
    typing:
      typing === 'ready' &&
      (typingCounters.value.started.typing > 0 || typingCounters.value.finished.typing > 0),
  };
  const settled = learning !== 'loading' && typing !== 'loading';
  // Without a hash the section with data opens, once both stores have said what they hold.
  const section = chosen ?? (settled ? initialSection('', has) : 'learning');

  const heading = <h1 className="text-ui-title text-fur">{t('page.stats')}</h1>;

  if (learning === 'ready' && typing === 'ready' && !has.learning && !has.typing) {
    return (
      <section className="max-w-layout-max mx-auto flex w-full flex-col gap-12">
        {heading}
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

  const choose = (next: Section): void => {
    setChosen(next);
    window.history.replaceState(
      null,
      '',
      `${window.location.pathname}${window.location.search}#${next}`,
    );
  };
  const status = section === 'learning' ? learning : typing;

  return (
    <section className="max-w-layout-max mx-auto flex w-full flex-col gap-8 sm:gap-12">
      <div className="flex flex-col gap-6">
        {heading}
        <div>
          <Segmented<Section>
            size="lg"
            options={[
              { value: 'learning', label: t('stats.section.learning') },
              { value: 'typing', label: t('stats.section.typing') },
            ]}
            value={section}
            onChange={choose}
            ariaLabel={t('stats.section.label')}
          />
        </div>
      </div>

      {status !== 'ready' ? (
        <Pending
          status={status}
          onRetry={() => {
            void (section === 'learning' ? retryLearn() : retryTyping());
          }}
        />
      ) : section === 'learning' ? (
        <LearningSection results={results} />
      ) : (
        <TypingSection
          results={results}
          failed={failed}
          onRetry={() => {
            setFailed(false);
            setAttempt(attempt + 1);
          }}
        />
      )}
    </section>
  );
}
