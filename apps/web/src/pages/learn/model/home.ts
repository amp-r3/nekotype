import { computed, effect, signal } from '@preact/signals';
import type { ReadonlySignal } from '@preact/signals';
import type { LearnView, Reason } from '@nekotype/model';
import type { Clock, Scheduler, TimeoutHandle, Track } from '@nekotype/shared/types';
import { localDay, streakOfDays } from '@/entities/learn';
import { REPLAN_MS } from '../lib/constants';

// The page model of the learning home (P8 plan, D2, D5, D6): what Continue does first, whether it
// may start, and what the screen derives from the learn view. The home owns it only while it is
// mounted, so nothing runs during a session: the effect, the timer and the listener end with it.

export type HomeDeps = {
  readonly track: ReadonlySignal<Track>;
  readonly view: ReadonlySignal<LearnView | null>;
  /** The store is loaded and no sign-in is being settled. */
  readonly ready: ReadonlySignal<boolean>;
  /** `reasonOf` on the live state; null until the store is ready. */
  readonly reasonAt: (now: number, track: Track) => Reason | null;
  readonly requestInsights: (track: Track) => void;
  readonly clock: Clock;
  readonly scheduler: Scheduler;
  readonly visibility: {
    /** Calls the listener when the tab becomes visible; returns the way to stop. */
    readonly onVisible: (listener: () => void) => () => void;
  };
};

export type HomeModel = {
  /** Null until the store is ready. The same object while the reason does not change. */
  readonly reason: ReadonlySignal<Reason | null>;
  /** Ready and something to do: neither a click nor Enter starts a session otherwise. */
  readonly canStart: ReadonlySignal<boolean>;
  /** The current streak; null before the first answer (any track). */
  readonly streak: ReadonlySignal<number | null>;
  /** The first visit: no answer yet. */
  readonly first: ReadonlySignal<boolean>;
  /** The katakana suggestion of D5. */
  readonly suggestKatakana: ReadonlySignal<boolean>;
  readonly dispose: () => void;
};

function sameReason(a: Reason | null, b: Reason | null): boolean {
  if (a === null || b === null) return a === b;
  switch (a.kind) {
    case 'review':
      return b.kind === 'review' && a.due === b.due;
    case 'weak':
      return (
        b.kind === 'weak' &&
        a.keys.length === b.keys.length &&
        a.keys.every((key, at) => key === b.keys[at])
      );
    case 'learning':
      return b.kind === 'learning' && a.learning === b.learning;
    case 'new':
      return b.kind === 'new' && a.key === b.key && a.row === b.row;
    case 'none':
      return b.kind === 'none' && a.nextAt === b.nextAt;
  }
}

export function createHomeModel(deps: HomeDeps): HomeModel {
  const reason = signal<Reason | null>(null);
  const plan = (view: LearnView | null): void => {
    if (!deps.ready.peek() || view === null) {
      if (reason.peek() !== null) reason.value = null;
      return;
    }
    const next = deps.reasonAt(deps.clock.now(), deps.track.peek());
    // A tick that changes nothing sets nothing, so it renders nothing.
    if (!sameReason(reason.peek(), next)) reason.value = next;
  };

  // The view, the track and readiness: plan again and ask for the insights (they run in scheduler
  // callbacks, never here).
  const stopEffect = effect(() => {
    const ready = deps.ready.value;
    const track = deps.track.value;
    // Every publish of the learn view plans again, so a session that has just ended is read.
    plan(deps.view.value);
    if (ready) deps.requestInsights(track);
  });

  let handle: TimeoutHandle | null = null;
  const schedule = (): void => {
    handle = deps.scheduler.setTimeout(() => {
      handle = null;
      plan(deps.view.peek());
      schedule();
    }, REPLAN_MS);
  };
  schedule();
  const stopVisible = deps.visibility.onVisible(() => {
    plan(deps.view.peek());
  });

  const canStart = computed(() => reason.value !== null && reason.value.kind !== 'none');
  const streak = computed(() => {
    const view = deps.view.value;
    if (view === null || view.stats.days.size === 0) return null;
    return streakOfDays(view.stats.days, localDay(deps.clock.now()));
  });
  const first = computed(() => {
    const view = deps.view.value;
    return view !== null && view.stats.days.size === 0;
  });
  const suggestKatakana = computed(() => {
    const view = deps.view.value;
    return (
      view !== null &&
      deps.track.value === 'hiragana' &&
      view.suggestKatakana &&
      view.introduced.katakana === 0
    );
  });

  return {
    reason,
    canStart,
    streak,
    first,
    suggestKatakana,
    dispose() {
      stopEffect();
      stopVisible();
      if (handle !== null) deps.scheduler.clearTimeout(handle);
      handle = null;
    },
  };
}
