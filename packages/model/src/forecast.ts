import type { LearnKanaKey, Rng, Track } from '@nekotype/shared/types';
import {
  DAY_MS,
  FORECAST_HISTORY,
  FORECAST_HISTORY_MIN,
  FORECAST_MAX_SESSIONS,
  FORECAST_MAX_SITTINGS,
  FORECAST_PLAYS,
  GAP_MIN_MS,
  OUTCOMES_MIN,
  PLAY_OK_MS,
  PLAY_WRONG_MS,
  SESSION_TASKS,
  SITTING_DEFAULT_MS,
  TASK_DEFAULT_MS,
} from './constants';
import { foldFromState } from './fold';
import type { Fold, ModelState } from './fold';
import { retrievability } from './fsrs';
import { trackRows } from './items';
import type { RowId } from './items';
import { horizonMs } from './learner';
import { nextTask } from './planner';
import type { PlannedTask } from './planner';

/** The line of a play's answers: a play grades every correct answer good. */
const ALWAYS_GOOD = (): number => Number.POSITIVE_INFINITY;

export type Habits = {
  /** A sitting's usual length: the median of `sittings` plus the median of `taskMs`; SITTING_DEFAULT_MS while empty. */
  readonly sittingMs: number;
  /** `horizonMs(state)`: sittings start this far apart. */
  readonly gapMs: number;
  /** The median of `taskMs`, or TASK_DEFAULT_MS while it holds fewer than OUTCOMES_MIN. */
  readonly taskMs: number;
  /** Correct shares of `outcomes.learning` and `outcomes.review`; null while learning has fewer than OUTCOMES_MIN (then the model predicts). */
  readonly shares: { readonly learning: number; readonly review: number } | null;
};

/** `forecast`: a past `Forecast.raw`; `actual`: the sessions it took. */
export type SettledForecast = { readonly forecast: number; readonly actual: number };

/** Sessions; FORECAST_MAX_SESSIONS + 1 means "not within 60 sessions". */
export type Forecast = {
  readonly row: RowId;
  /** The median before the correction: what `SettledForecast.forecast` keeps. */
  readonly raw: number;
  readonly low: number;
  readonly median: number;
  readonly high: number;
};

export type Outline = {
  readonly reviews: number;
  readonly learning: number;
  readonly introductions: number;
};

/** The element at ⌊length / 2⌋ of the sorted list, as the horizon takes it. */
function median(values: readonly number[]): number | null {
  if (values.length === 0) return null;
  const sorted = [...values].sort((a, b) => a - b);
  return sorted[Math.floor(sorted.length / 2)] ?? null;
}

function share(list: readonly boolean[]): number {
  return list.filter(Boolean).length / list.length;
}

export function habitsOf(state: ModelState): Habits {
  const { sittings, taskMs, outcomes } = state.learner;
  const task = taskMs.length < OUTCOMES_MIN ? TASK_DEFAULT_MS : (median(taskMs) ?? TASK_DEFAULT_MS);
  const sitting = median(sittings);
  const learning = outcomes.learning.length < OUTCOMES_MIN ? null : share(outcomes.learning);
  return {
    sittingMs:
      sitting === null ? SITTING_DEFAULT_MS : sitting + (median(taskMs) ?? TASK_DEFAULT_MS),
    gapMs: horizonMs(state),
    taskMs: task,
    shares:
      learning === null
        ? null
        : {
            learning,
            review: outcomes.review.length < OUTCOMES_MIN ? learning : share(outcomes.review),
          },
  };
}

/** The first row of the track with a kana not introduced; null when every kana is introduced. */
export function nextRow(state: ModelState, track: Track): RowId | null {
  for (const row of trackRows(track)) {
    if (row.keys.some((key) => !state.items.has(key))) return row.id;
  }
  return null;
}

/** One play: the state forward, one task at a time, with the answers a draw decides. */
type Play = {
  readonly fold: Fold;
  readonly track: Track;
  readonly rng: Rng;
  readonly habits: Habits;
  /** Device clock of the play, ms. */
  at: number;
  n: number;
};

/** Plays one session from `play.at`: up to SESSION_TASKS tasks; returns how many were made. */
function playSession(play: Play, onTask?: (task: PlannedTask) => void): number {
  const { fold, habits } = play;
  let previous: LearnKanaKey | null = null;
  let count = 0;
  while (count < SESSION_TASKS) {
    const task = nextTask(fold.state, {
      now: play.at,
      track: play.track,
      previous,
      rng: play.rng,
    });
    if (task === null) break;
    onTask?.(task);
    play.n += 1;
    if (task.kind === 'introduction') {
      fold.apply({ t: 'intro', at: play.at, dev: PLAY_DEV, n: play.n, k: task.key });
    } else {
      const ok = play.rng.next() < chanceOf(play, task);
      fold.apply({
        t: 'answer',
        at: play.at,
        dev: PLAY_DEV,
        n: play.n,
        task: task.kind,
        k: task.key,
        ok,
        ms: ok ? PLAY_OK_MS : PLAY_WRONG_MS,
        hint: false,
        wrong: null,
        alt: null,
      });
    }
    previous = task.key;
    count += 1;
    play.at += habits.taskMs;
  }
  return count;
}

const PLAY_DEV = '~play';

/** The chance that a play answers correctly: the learner's share of its kind, else the model's. */
function chanceOf(
  play: Play,
  task: Exclude<PlannedTask, { readonly kind: 'introduction' }>,
): number {
  const { shares } = play.habits;
  if (shares !== null) {
    return task.kind === 'recall' && task.review ? shares.review : shares.learning;
  }
  const item = play.fold.state.items.get(task.key);
  if (item === undefined) return 1;
  const p = retrievability(item.memory.stability, Math.max(0, play.at - item.lastAt) / DAY_MS);
  return task.kind === 'recognition' ? p + (1 - p) / 4 : p;
}

function startPlay(
  state: ModelState,
  ctx: { readonly track: Track; readonly rng: Rng; readonly habits: Habits; readonly now: number },
): Play {
  // A play's answer has a fixed time: every correct one is good, as the learner's typical answer.
  const fold = foldFromState(state, { stats: false, line: ALWAYS_GOOD });
  // The zone of one device stands for the learner's; the plays differ by a day edge at most.
  const tz = Object.values(state.learner.tz)[0] ?? 0;
  const play: Play = {
    fold,
    track: ctx.track,
    rng: ctx.rng,
    habits: ctx.habits,
    at: ctx.now,
    n: 1,
  };
  fold.apply({ t: 'start', at: ctx.now, dev: PLAY_DEV, n: 1, tz });
  return play;
}

/** Sessions until every kana of `keys` is introduced: FORECAST_MAX_SESSIONS + 1 when not reached. */
function playRow(
  state: ModelState,
  keys: readonly LearnKanaKey[],
  ctx: { readonly now: number; readonly track: Track; readonly rng: Rng; readonly habits: Habits },
): number {
  const { habits } = ctx;
  const play = startPlay(state, ctx);
  const done = (): boolean => keys.every((key) => play.fold.state.items.has(key));
  const { lastTaskAt, sittingStart } = state.learner;
  const current =
    lastTaskAt !== null && sittingStart !== null && ctx.now - lastTaskAt <= GAP_MIN_MS
      ? sittingStart
      : ctx.now;
  let sessions = 0;
  for (let sitting = 0; sitting < FORECAST_MAX_SITTINGS; sitting += 1) {
    const start = current + sitting * habits.gapMs;
    const end = start + habits.sittingMs;
    play.at = Math.max(play.at, sitting === 0 ? ctx.now : start);
    while (play.at < end) {
      if (playSession(play) === 0) break;
      sessions += 1;
      if (done()) return sessions;
      if (sessions >= FORECAST_MAX_SESSIONS) return FORECAST_MAX_SESSIONS + 1;
    }
  }
  return FORECAST_MAX_SESSIONS + 1;
}

export function forecastRow(
  state: ModelState,
  row: RowId,
  ctx: {
    readonly now: number;
    readonly track: Track;
    readonly rng: Rng;
    readonly habits: Habits;
    readonly history: readonly SettledForecast[];
  },
): Forecast {
  const keys = trackRows(row.startsWith('hiragana') ? 'hiragana' : 'katakana').find(
    (r) => r.id === row,
  )?.keys;
  if (keys === undefined) throw new Error(`no row ${row}`);
  const plays = Array.from({ length: FORECAST_PLAYS }, () => playRow(state, keys, ctx)).sort(
    (a, b) => a - b,
  );
  const at = (q: number): number => plays[Math.round(q * (FORECAST_PLAYS - 1))] ?? 0;
  const recent = ctx.history.slice(-FORECAST_HISTORY);
  const ratio =
    recent.length < FORECAST_HISTORY_MIN
      ? 1
      : (recent.map((s) => s.actual / s.forecast).sort((a, b) => a - b)[
          Math.floor(recent.length / 2)
        ] ?? 1);
  const corrected = (n: number): number => (ratio === 1 ? n : Math.max(1, Math.round(n * ratio)));
  return {
    row,
    raw: at(0.5),
    low: corrected(at(0.1)),
    median: corrected(at(0.5)),
    high: corrected(at(0.9)),
  };
}

/** The next session as the model would play it: how many reviews, learning tasks and introductions. */
export function outlineSession(
  state: ModelState,
  ctx: { readonly now: number; readonly track: Track; readonly rng: Rng },
): Outline {
  // The model predicts the answers: the habits' shares are left out.
  const habits: Habits = { ...habitsOf(state), shares: null };
  const play = startPlay(state, { ...ctx, habits });
  let reviews = 0;
  let learning = 0;
  let introductions = 0;
  playSession(play, (task) => {
    if (task.kind === 'introduction') introductions += 1;
    else if (task.kind === 'recall' && task.review) reviews += 1;
    else learning += 1;
  });
  return { reviews, learning, introductions };
}
