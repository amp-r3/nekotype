import type { JSX } from 'preact';
import type { Track } from '@nekotype/shared/types';
import { t, tPlural } from '@/shared/i18n';
import { headOfRow } from '@/entities/learn';
import type { ForecastState, ShownForecast } from '@/entities/learn';
import type { ForecastChange } from '../lib/summary';
import { forecastLine } from './home/panels/forecast-copy';

// The forecast change on top of the summary (design decision 148, ADR 108 point 8): the median
// before the session and now, `3 → 2 sessions`. The home keeps the range; this one comparison
// shows medians. A forecast that grew carries no colour and no words.

function openedLine(before: ShownForecast): string {
  const head = headOfRow(before.row);
  return head === '' ? t('summary.forecast.openedVowels') : t('summary.forecast.opened', { head });
}

/** The row of `before` is open now: `after` names another row, or the track is complete. */
function rowOpened(before: ShownForecast | null, after: ForecastState): boolean {
  if (before === null) return false;
  switch (after.kind) {
    case 'complete':
      return true;
    case 'ready':
      return after.forecast.row !== before.row;
    case 'beyond':
      return after.row !== before.row;
    case 'pending':
      return false;
  }
}

function Median({
  before,
  after,
}: {
  readonly before: number | null;
  readonly after: ShownForecast;
}): JSX.Element {
  const median = after.median;
  const head = headOfRow(after.row);
  return (
    <div
      className="flex flex-col gap-1"
      role={before === null ? undefined : 'group'}
      aria-label={
        before === null ? undefined : tPlural('summary.forecast.aria', median, { before })
      }
    >
      <p className="text-ui-caption text-fur-dim">
        {head === '' ? t('summary.forecast.leadVowels') : t('summary.forecast.lead', { head })}
      </p>
      <p className="text-mono-stat text-fur font-mono" data-testid="summary-forecast-value">
        {before !== null && (
          <>
            <span className="text-fur-dim">{before}</span>
            <span className="text-fur-dim"> → </span>
          </>
        )}
        {median}{' '}
        <span className="text-mono-romaji">{tPlural('summary.forecast.sessions', median)}</span>
      </p>
    </div>
  );
}

export function SummaryForecast({
  change,
  track,
}: {
  readonly change: ForecastChange;
  readonly track: Track;
}): JSX.Element {
  const { before, after } = change;
  const opened = rowOpened(before, after);
  if (after.kind === 'pending') {
    // The place keeps its height while the insights compute.
    return <div aria-busy="true" data-state="pending" className="min-h-[72px]" />;
  }
  const shown = (
    <>
      {opened && before !== null && (
        <p className="text-ui-body text-fur" data-testid="summary-forecast-opened">
          {openedLine(before)}
        </p>
      )}
      {after.kind === 'ready' ? (
        <Median before={opened ? null : (before?.median ?? null)} after={after.forecast} />
      ) : (
        <p className="text-ui-body text-fur-dim">{forecastLine(after, track)}</p>
      )}
    </>
  );
  return (
    <div className="flex flex-col gap-2" data-testid="summary-forecast" data-state={after.kind}>
      {shown}
    </div>
  );
}
