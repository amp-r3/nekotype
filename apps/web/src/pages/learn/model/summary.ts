import { computed, signal } from '@preact/signals';
import type { ReadonlySignal } from '@preact/signals';
import type { Reason } from '@nekotype/model';
import type { Clock, Track } from '@nekotype/shared/types';
import type { ForecastState, Insights, ShownForecast } from '@/entities/learn';
import type { ForecastChange } from '../lib/summary';

// The page model of the session summary (P8 plan, D2, D9): the forecast change and whether
// Continue may start another session. The summary owns it only while it is shown. It asks for the
// insights when it is shown and again when the learn view changes (the end of a session and a
// pull publish after the summary is up); the session itself never asks (rule 3d).

export type SummaryDeps = {
  /** The session's track: what the forecast is for. */
  readonly track: Track;
  /** The forecast shown when the session started. */
  readonly before: ShownForecast | null;
  /** Grows by one at every publish of the learn view. */
  readonly version: ReadonlySignal<number>;
  readonly insights: ReadonlySignal<Insights | null>;
  readonly requestInsights: (track: Track) => void;
  /** `reasonOf` on the live state; null until the store is ready. */
  readonly reasonAt: (now: number, track: Track) => Reason | null;
  readonly clock: Clock;
};

export type SummaryModel = {
  readonly change: ReadonlySignal<ForecastChange>;
  /** What the next session would do first; `none` when there is nothing to do (D2). */
  readonly reason: ReadonlySignal<Reason | null>;
  /** Something to do: neither a click nor Enter starts a session otherwise. */
  readonly canStart: ReadonlySignal<boolean>;
  readonly dispose: () => void;
};

const PENDING: ForecastState = { kind: 'pending' };

export function createSummaryModel(deps: SummaryDeps): SummaryModel {
  // At every publish of the learn view, now included: plan again (a session that ended early
  // reads its end) and ask for the insights of the new version.
  const reason = signal<Reason | null>(null);
  const stop = deps.version.subscribe(() => {
    reason.value = deps.reasonAt(deps.clock.now(), deps.track);
    deps.requestInsights(deps.track);
  });

  // Insights of an older version or another track are not "after": until the request for this
  // version has published, the forecast is pending.
  const change = computed<ForecastChange>(() => {
    const current = deps.insights.value;
    const after =
      current !== null && current.track === deps.track && current.version === deps.version.value
        ? current.forecast
        : PENDING;
    return { before: deps.before, after };
  });

  const canStart = computed(() => reason.value !== null && reason.value.kind !== 'none');

  return { change, reason, canStart, dispose: stop };
}
