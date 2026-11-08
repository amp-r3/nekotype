import type { JSX } from 'preact';
import { useEffect } from 'preact/hooks';
import { t } from '@/shared/i18n';
import { Button, Segmented } from '@/shared/ui';
import { KanaChart } from '@/shared/ui/kana-chart';
import { chartModel, kanaDetails } from '../lib/chart';
import { learnTargetMs, learnTrack, setTrack } from '@/entities/settings';
import type { LearnTrack } from '@/entities/settings';
import { defaultClock } from '@/shared/lib';
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
} from '@/entities/learn';

// The learning screen: track switch, progress and the kana chart. The sessions follow in later
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
  const keys = keysOfTrack(track);
  const target = learnTargetMs.value;
  const mastered = keys.filter((key) =>
    isMastered(state.entries[key], state.recent[key] ?? [], target),
  ).length;
  const now = defaultClock.now();
  const infos = cellInfos(track, state, target, now);
  const streak = currentStreak(state.activeDays, localDay(now));

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
  );
}
