import type { JSX } from 'preact';
import { useEffect } from 'preact/hooks';
import { t } from '@/shared/i18n';
import { Segmented } from '@/shared/ui';
import { learnTargetMs, learnTrack, setTrack } from '@/entities/settings';
import type { LearnTrack } from '@/entities/settings';
import { defaultClock } from '@/shared/lib';
import {
  currentStreak,
  initLearn,
  isMastered,
  keysOfTrack,
  learnReady,
  learnState,
  localDay,
} from '@/entities/learn';

// The top of the learning screen. The chart and the sessions follow in later
// pull requests (docs/spec/learning.md, "`/` screen").
export function LearnPage(): JSX.Element {
  useEffect(() => {
    void initLearn(() => learnTargetMs.value);
  }, []);

  if (!learnReady.value) {
    return (
      <p role="status" className="text-fur-dim text-ui-label py-12 text-center">
        {t('route.loading')}
      </p>
    );
  }

  const track = learnTrack.value;
  const state = learnState.value;
  const unlocked = state.unlocked[track];
  const keys = keysOfTrack(track);
  const target = learnTargetMs.value;
  const mastered = keys.filter((key) =>
    isMastered(state.entries[key], state.recent[key] ?? [], target),
  ).length;
  const streak = currentStreak(state.activeDays, localDay(defaultClock.now()));

  return (
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

      <p
        lang="ja"
        aria-label={t('learn.unlocked.list')}
        className="text-fur-dim text-ui-body break-words"
        data-testid="learn-unlocked-list"
      >
        {unlocked.map((key) => key.slice(key.indexOf(':') + 1)).join(' ')}
      </p>
    </section>
  );
}
