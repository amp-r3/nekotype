import type { LearnView } from '@nekotype/model';
import type { JSX } from 'preact';
import { t } from '@/shared/i18n';
import { KanaChart } from '@/shared/ui/kana-chart';
import type { LearnTrack } from '@/entities/settings';
import { cellInfos, keyOf } from '@/entities/learn';
import { openKanaDetails } from '@/features/kana-details';
import { chartBlockLabels, chartLegend, chartModel } from '../lib/chart';

// The kana table of the shown track. An introduced kana opens its details in the dialog.
export function ProgressChart({
  view,
  track,
  now,
}: {
  readonly view: LearnView;
  readonly track: LearnTrack;
  readonly now: number;
}): JSX.Element {
  return (
    <div className="w-full">
      <KanaChart
        rows={chartModel(track, cellInfos(track, view, now))}
        ariaLabel={t('learn.chart.label')}
        blockLabels={chartBlockLabels()}
        legend={chartLegend(track)}
        onOpen={(kana) => {
          openKanaDetails(keyOf(track, kana));
        }}
      />
    </div>
  );
}
