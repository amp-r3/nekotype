import type { Outline, RowId, Stronger } from '@nekotype/model';
import type { Track } from '@nekotype/shared/types';

// The shapes of the insights (P8 plan, D8). Types only: the initial chunk, the state module and the
// lazy computation all read them without importing each other's code.

export type ForecastBasis = 'model' | 'habits' | 'corrected';

export type ShownForecast = {
  readonly row: RowId;
  readonly low: number;
  readonly median: number;
  readonly high: number;
  /** The median before the correction: what the history keeps. */
  readonly raw: number;
  /**
   * `model`: `habitsOf(state).shares` is null (fewer than OUTCOMES_MIN learning answers);
   * `habits`: fewer than FORECAST_HISTORY_MIN settled forecasts; `corrected`: otherwise.
   */
  readonly basis: ForecastBasis;
};

export type ForecastState =
  | { readonly kind: 'pending' }
  | { readonly kind: 'ready'; readonly forecast: ShownForecast }
  /** `raw` over FORECAST_MAX_SESSIONS: the row has no forecast. */
  | { readonly kind: 'beyond'; readonly row: RowId }
  /** Every kana of the track is introduced (`nextRow` is null). */
  | { readonly kind: 'complete' };

export type StrongerState =
  | { readonly kind: 'pending' }
  /** No session has started yet: the log has no `start`. */
  | { readonly kind: 'first' }
  | { readonly kind: 'ready'; readonly kana: readonly Stronger[] };

export type Insights = {
  /** The `learnVersion` and the track they were computed for. */
  readonly version: number;
  readonly track: Track;
  /** Null until step 1 has run. */
  readonly outline: Outline | null;
  readonly stronger: StrongerState;
  readonly forecast: ForecastState;
};

/** One forecast shown on a screen, kept on the device until its row is introduced (D10). */
export type ForecastRecord = {
  readonly row: RowId;
  /** The device's local day when it was shown. */
  readonly day: number;
  /** When it was shown, ms. */
  readonly at: number;
  /** `ShownForecast.raw`: 1 to FORECAST_MAX_SESSIONS. */
  readonly raw: number;
  /** `LogStats.started` when it was shown: the sessions before it. */
  readonly started: number;
  /** Sessions it took; null while its row has a locked kana. */
  readonly actual: number | null;
};
