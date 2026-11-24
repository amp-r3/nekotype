import type { JSX } from 'preact';
import type { Track } from '@nekotype/shared/types';
import { t } from '@/shared/i18n';
import type { ForecastState } from '@/entities/learn';
import { forecastLine } from './forecast-copy';

// The forecast under the path's title (design decision 142): one line, a rough-estimate caption
// for the model's and the habits' basis, and the line's height held while it computes.
export function HomeForecast({
  state,
  track,
}: {
  readonly state: ForecastState;
  readonly track: Track;
}): JSX.Element {
  const line = forecastLine(state, track);
  if (line === null) {
    // No test id: the latency probe waits for the forecast itself, not for its place.
    return <p className="text-ui-label min-h-5" aria-busy="true" data-state="pending" />;
  }
  const rough =
    state.kind === 'ready' &&
    (state.forecast.basis === 'model' || state.forecast.basis === 'habits');
  return (
    <div className="flex flex-col gap-1" data-testid="home-forecast" data-state={state.kind}>
      <p className="text-ui-label text-fur">{line}</p>
      {rough && <p className="text-ui-caption text-fur-dim">{t('home.forecast.rough')}</p>}
    </div>
  );
}
