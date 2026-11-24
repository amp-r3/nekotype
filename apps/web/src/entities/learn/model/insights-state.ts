import { signal } from '@preact/signals';
import type { ReadonlySignal } from '@preact/signals';
import type * as ModelModule from '@nekotype/model';
import type { Clock, Scheduler, TimeoutHandle, Track } from '@nekotype/shared/types';
import type { Db } from '@/shared/lib';
import { defaultClock, defaultScheduler, getDatabase } from '@/shared/lib';
import type * as InsightsModule from './insights';
import type { InsightsEngine } from './insights';
import type { Insights } from './insights-types';
import {
  learnVersion,
  learnView,
  loadedInsights,
  loadedModel,
  modelState,
  onLearnReset,
  onSessionStart,
  startSnapshot,
} from './learn-store';

// What the learning home and the session summary show besides the planner's reason (P8 plan, D8):
// the outline, what got stronger and the forecast. Small and in the initial chunk; the computation
// is `insights.ts`, a lazy chunk. A screen asks with `requestInsights`; the work runs in two
// callbacks of the injected `Scheduler`, so a render or a key handler never waits for it.

type Model = typeof ModelModule;
type LearnView = ModelModule.LearnView;

export type InsightsStateDeps = {
  readonly view: () => LearnView | null;
  readonly version: () => number;
  readonly state: () => ModelModule.ModelState | null;
  readonly startSnapshot: () => ReturnType<ModelModule.Fold['snapshot']> | null;
  readonly model: () => Model | null;
  /** The lazy computation (`insights.ts`): null until the store is ready. */
  readonly module: () => typeof InsightsModule | null;
  /** The device's database, for the forecast history. */
  readonly db: () => Promise<Db>;
  readonly clock: Clock;
  readonly scheduler: Scheduler;
  readonly onSessionStart: (listener: () => void) => () => void;
  readonly onReset: (listener: () => void) => () => void;
};

export type InsightsState = {
  readonly insights: ReadonlySignal<Insights | null>;
  readonly requestInsights: (track: Track) => void;
  readonly reasonAt: (now: number, track: Track) => ModelModule.Reason | null;
};

type Request = { readonly version: number; readonly track: Track };

export function createInsightsState(deps: InsightsStateDeps): InsightsState {
  const insights = signal<Insights | null>(null);
  let active: Request | null = null;
  let handle: TimeoutHandle | null = null;
  let engine: InsightsEngine | null = null;

  const cancel = (): void => {
    if (handle !== null) deps.scheduler.clearTimeout(handle);
    handle = null;
    active = null;
  };

  // Nothing computes during a session; `insights.value` stays, the summary reads its forecast.
  deps.onSessionStart(cancel);
  deps.onReset(() => {
    cancel();
    engine?.drop();
  });

  const isCurrent = (request: Request): boolean =>
    active === request && deps.version() === request.version;

  const published = (request: Request): Insights | null => {
    const value = insights.peek();
    return value !== null && value.version === request.version && value.track === request.track
      ? value
      : null;
  };

  const stepTwo = async (request: Request, model: Model): Promise<void> => {
    const loaded = deps.module();
    if (loaded === null) return;
    engine ??= loaded.createInsightsEngine({ model, db: deps.db });
    const result = await engine.forecast(
      { view: deps.view, state: deps.state, now: deps.clock.now(), track: request.track },
      () => isCurrent(request),
    );
    if (result === null || !isCurrent(request)) return;
    const value = published(request);
    if (value === null) return;
    insights.value = { ...value, forecast: result.forecast };
    active = null;
    if (result.record !== null) await engine.record(result.record);
  };

  const stepOne = (request: Request): void => {
    handle = null;
    const model = deps.model();
    const view = deps.view();
    const state = deps.state();
    const loaded = deps.module();
    if (!isCurrent(request) || model === null || view === null || state === null) return;
    if (loaded === null) return;
    const value = published(request);
    if (value === null) return;
    insights.value = {
      ...value,
      ...loaded.computeStepOne(model, {
        view,
        state,
        startSnapshot: deps.startSnapshot(),
        now: deps.clock.now(),
        track: request.track,
      }),
    };
    handle = deps.scheduler.setTimeout(() => {
      handle = null;
      void stepTwo(request, model);
    }, 0);
  };

  return {
    insights,

    requestInsights(track) {
      const version = deps.version();
      if (deps.model() === null || deps.view() === null) return;
      const value = insights.peek();
      if (value !== null && value.version === version && value.track === track) {
        // Computed, or being computed.
        const done = value.outline !== null && value.forecast.kind !== 'pending';
        if (done || (active !== null && active.version === version && active.track === track)) {
          return;
        }
      }
      cancel();
      const request: Request = { version, track };
      active = request;
      insights.value = {
        version,
        track,
        outline: null,
        stronger: { kind: 'pending' },
        forecast: { kind: 'pending' },
      };
      handle = deps.scheduler.setTimeout(() => {
        stepOne(request);
      }, 0);
    },

    reasonAt(now, track) {
      const model = deps.model();
      const view = deps.view();
      const state = deps.state();
      if (model === null || view === null || state === null) return null;
      return model.reasonOf(state, view, { now, track });
    },
  };
}

const shared = createInsightsState({
  // `peek`: asking never subscribes the caller's effect; a screen follows `learnVersion` itself.
  view: () => learnView.peek(),
  version: () => learnVersion.peek(),
  state: modelState,
  startSnapshot,
  model: loadedModel,
  module: loadedInsights,
  db: getDatabase,
  clock: defaultClock,
  scheduler: defaultScheduler,
  onSessionStart,
  onReset: onLearnReset,
});

export const insights: ReadonlySignal<Insights | null> = shared.insights;
/** The home or the summary is on screen: compute for the current log and `track`. */
export const requestInsights = shared.requestInsights;
/** `reasonOf` on the live state (D1); null until the store is ready. Cheap: one planner call. */
export const reasonAt = shared.reasonAt;
