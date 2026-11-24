import type * as ModelModule from '@nekotype/model';
import type { LearnKanaKey, Track } from '@nekotype/shared/types';
import type { Db } from '@/shared/lib';
import { localDay } from '../lib/day';
import { createForecastHistory } from './forecasts';
import type { ForecastRecord, ForecastState, ShownForecast, StrongerState } from './insights-types';

// The computation of the insights (P8 plan, D8): lazy, reached by a dynamic import that the store
// starts with the model chunk. It runs only in the callbacks of the injected `Scheduler`, never in
// a render or a key handler.

type Model = typeof ModelModule;
type LearnView = ModelModule.LearnView;
type ModelState = ModelModule.ModelState;
type RowId = ModelModule.RowId;

/** The seed of the forecast's plays: the same state gives the same numbers (D8). */
export const FORECAST_SEED = 1;
/** The seed of the outline's play. */
export const OUTLINE_SEED = 2;

export type StepOneInput = {
  readonly view: LearnView;
  readonly state: ModelState;
  /** The state just before the last `start`; null without one. */
  readonly startSnapshot: ReturnType<ModelModule.Fold['snapshot']> | null;
  readonly now: number;
  readonly track: Track;
};

/** Step 1: what got stronger (D3) and the outline (D7). */
export function computeStepOne(
  model: Model,
  input: StepOneInput,
): { readonly outline: ModelModule.Outline; readonly stronger: StrongerState } {
  const { startSnapshot } = input;
  const outline = model.outlineSession(input.state, {
    now: input.now,
    track: input.track,
    rng: model.seededRng(OUTLINE_SEED),
  });
  if (startSnapshot === null || startSnapshot.stats === null) {
    return { outline, stronger: { kind: 'first' } };
  }
  const before = model.describe(startSnapshot.state, startSnapshot.stats);
  return {
    outline,
    stronger: { kind: 'ready', kana: model.strongerSince(before, input.view) },
  };
}

export type StepTwoInput = {
  readonly view: () => LearnView | null;
  readonly state: () => ModelState | null;
  readonly now: number;
  readonly track: Track;
};

export type StepTwoResult = {
  readonly forecast: ForecastState;
  /** The record to keep once the forecast is published; null for `beyond` and `complete`. */
  readonly record: ForecastRecord | null;
};

export type InsightsEngine = {
  /**
   * Step 2: settles the history, then forecasts the track's next row. Null when `current()` turned
   * false at an await: the request is stale and nothing is published.
   */
  forecast: (input: StepTwoInput, current: () => boolean) => Promise<StepTwoResult | null>;
  /** Keeps a shown forecast (D10). */
  record: (record: ForecastRecord) => Promise<void>;
  /** The store `forecasts` was cleared underneath. */
  drop: () => void;
};

export function createInsightsEngine(deps: {
  readonly model: Model;
  readonly db: () => Promise<Db>;
}): InsightsEngine {
  const { model } = deps;
  const history = createForecastHistory(deps.db);
  const rowKeys = new Map<RowId, readonly LearnKanaKey[]>();
  for (const track of ['hiragana', 'katakana'] as const) {
    for (const row of model.trackRows(track)) rowKeys.set(row.id, row.keys);
  }

  /** `introducedIn` of the row's last kana; null while one is locked. */
  const lastIntroduced = (view: LearnView, row: RowId): number | null => {
    let last = 0;
    for (const key of rowKeys.get(row) ?? []) {
      const introducedIn = view.kana.get(key)?.introducedIn ?? null;
      if (introducedIn === null) return null;
      last = Math.max(last, introducedIn);
    }
    return last;
  };

  return {
    async forecast(input, current) {
      await history.load();
      if (!current()) return null;
      const settleView = input.view();
      if (settleView === null) return null;
      await history.settle((row) => lastIntroduced(settleView, row));
      if (!current()) return null;
      const view = input.view();
      const state = input.state();
      if (view === null || state === null) return null;

      const row = model.nextRow(state, input.track);
      if (row === null) return { forecast: { kind: 'complete' }, record: null };

      const habits = model.habitsOf(state);
      const settled = history.settled();
      const forecast = model.forecastRow(state, row, {
        now: input.now,
        track: input.track,
        rng: model.seededRng(FORECAST_SEED),
        habits,
        history: settled.flatMap((r) =>
          r.actual === null ? [] : [{ forecast: r.raw, actual: r.actual }],
        ),
      });
      if (forecast.raw > model.FORECAST_MAX_SESSIONS) {
        return { forecast: { kind: 'beyond', row }, record: null };
      }
      const shown: ShownForecast = {
        row,
        low: forecast.low,
        median: forecast.median,
        high: forecast.high,
        raw: forecast.raw,
        basis:
          habits.shares === null
            ? 'model'
            : settled.length < model.FORECAST_HISTORY_MIN
              ? 'habits'
              : 'corrected',
      };
      return {
        forecast: { kind: 'ready', forecast: shown },
        record: {
          row,
          day: localDay(input.now),
          at: input.now,
          raw: forecast.raw,
          started: view.stats.started,
          actual: null,
        },
      };
    },

    record: (record) => history.add(record),
    drop: () => {
      history.drop();
    },
  };
}
