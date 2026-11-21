import type { EventId, LearnKanaKey, LogEvent, AnswerEvent } from '@nekotype/shared/types';
import {
  ADAPT_RATE,
  GAP_MIN_MS,
  GAPS_KEPT,
  OUTCOMES_KEPT,
  SITTINGS_KEPT,
  TASK_MS_KEPT,
  DAY_MS,
} from './constants';
import { firstMemory, nextMemory } from './fsrs';
import type { Memory } from './fsrs';
import { effectsOf } from './grade';
import { ITEMS, isWordKey } from './items';
import { recallsToLearn } from './learner';
import { compareEvents, eventKey, localDay } from './order';

export type Phase = 'learning' | 'learned'; // a new kana has no entry

export type ItemState = {
  readonly phase: Phase;
  readonly memory: Memory; // FSRS-6; stability in days
  /** `at` of the last event that updated it: introduction, answer, credit. */
  readonly lastAt: number;
  /** Local day of `lastAt`, in the zone of the device that wrote that event. */
  readonly lastDay: number;
  /** Correct recalls in a row while learning. */
  readonly streak: number;
  /** `learner.tasks` when it was last the task's kana (credit does not move it). */
  readonly lastTask: number;
};

export type LearnerState = {
  /** Introductions and answers folded. */
  readonly tasks: number;
  readonly lastTaskAt: number | null;
  /** `at` of the first task of the current sitting (a sitting ends at a gap over an hour). */
  readonly sittingStart: number | null;
  /** The last 10 gaps of over an hour between two tasks, ms, oldest first. */
  readonly gaps: readonly number[];
  /** The last 10 finished sittings: first to last task, ms. */
  readonly sittings: readonly number[];
  /** The last 200 intervals between two tasks of one sitting, ms. */
  readonly taskMs: readonly number[];
  /** Moving average of review outcomes, rate 0.05, from 0.90. */
  readonly observed: number;
  /** The last 200 outcomes of answers on learning kana and of reviews (the forecast). */
  readonly outcomes: { readonly learning: readonly boolean[]; readonly review: readonly boolean[] };
  /** Per `dev`, the `tz` of its last session start. */
  readonly tz: Readonly<Record<string, number>>;
};

export type ModelState = {
  readonly items: ReadonlyMap<LearnKanaKey, ItemState>;
  readonly learner: LearnerState;
  /** asked → given → count; only counts above 0. */
  readonly confusions: ReadonlyMap<LearnKanaKey, ReadonlyMap<LearnKanaKey, number>>;
  readonly targetMs: number;
};

export type FoldOptions = { readonly targetMs: number };
export type ApplyResult = 'applied' | 'duplicate' | 'out-of-order';

export interface Fold {
  /** Applies an event that sorts after the last one applied; otherwise changes nothing. */
  apply(event: LogEvent): ApplyResult;
  /** Live and read-only: valid until the next `apply`. The planner reads it. */
  readonly state: ModelState;
  readonly last: EventId | null;
  /** Events skipped by rule 1. */
  readonly ignored: number;
  /** A copy that later applies do not change, for signals: O(kana). */
  snapshot(): { readonly state: ModelState };
  /** An independent fold with the same state. */
  clone(options?: Partial<FoldOptions>): Fold;
}

const OBSERVED_START = 0.9;

type MutableLearner = {
  tasks: number;
  lastTaskAt: number | null;
  sittingStart: number | null;
  gaps: number[];
  sittings: number[];
  taskMs: number[];
  observed: number;
  outcomes: { learning: boolean[]; review: boolean[] };
  tz: Record<string, number>;
};

type Data = {
  readonly items: Map<LearnKanaKey, ItemState>;
  readonly learner: MutableLearner;
  readonly confusions: Map<LearnKanaKey, Map<LearnKanaKey, number>>;
  readonly seen: Set<string>;
  last: EventId | null;
  ignored: number;
};

function pushKept<T>(list: T[], value: T, max: number): void {
  list.push(value);
  if (list.length > max) list.splice(0, list.length - max);
}

function copyLearner(l: MutableLearner): MutableLearner {
  return {
    ...l,
    gaps: [...l.gaps],
    sittings: [...l.sittings],
    taskMs: [...l.taskMs],
    outcomes: { learning: [...l.outcomes.learning], review: [...l.outcomes.review] },
    tz: { ...l.tz },
  };
}

function copyConfusions(
  from: ReadonlyMap<LearnKanaKey, ReadonlyMap<LearnKanaKey, number>>,
): Map<LearnKanaKey, Map<LearnKanaKey, number>> {
  const copy = new Map<LearnKanaKey, Map<LearnKanaKey, number>>();
  for (const [asked, row] of from) copy.set(asked, new Map(row));
  return copy;
}

function copyData(d: Data): Data {
  return {
    items: new Map(d.items),
    learner: copyLearner(d.learner),
    confusions: copyConfusions(d.confusions),
    seen: new Set(d.seen),
    last: d.last,
    ignored: d.ignored,
  };
}

function emptyData(): Data {
  return {
    items: new Map(),
    learner: {
      tasks: 0,
      lastTaskAt: null,
      sittingStart: null,
      gaps: [],
      sittings: [],
      taskMs: [],
      observed: OBSERVED_START,
      outcomes: { learning: [], review: [] },
      tz: {},
    },
    confusions: new Map(),
    seen: new Set(),
    last: null,
    ignored: 0,
  };
}

function build(data: Data, options: FoldOptions): Fold {
  const { targetMs } = options;
  const { items, learner, confusions } = data;
  const state: ModelState = { items, learner, confusions, targetMs };

  const dayOf = (e: EventId): number => localDay(e.at, learner.tz[e.dev] ?? 0);

  /** Rule 3: the learner's clock moves on every task. */
  function noteTask(at: number): void {
    const { lastTaskAt } = learner;
    if (lastTaskAt === null) {
      learner.sittingStart = at;
      return;
    }
    const gap = Math.max(0, at - lastTaskAt);
    if (gap > GAP_MIN_MS) {
      pushKept(learner.gaps, gap, GAPS_KEPT);
      if (learner.sittingStart !== null) {
        pushKept(learner.sittings, lastTaskAt - learner.sittingStart, SITTINGS_KEPT);
      }
      learner.sittingStart = at;
    } else {
      pushKept(learner.taskMs, gap, TASK_MS_KEPT);
    }
  }

  function introduce(key: LearnKanaKey, e: EventId): void {
    items.set(key, {
      phase: 'learning',
      memory: firstMemory(1),
      lastAt: e.at,
      lastDay: dayOf(e),
      streak: 0,
      lastTask: learner.tasks,
    });
  }

  function addConfusion(asked: LearnKanaKey, given: LearnKanaKey, delta: 1 | -1): void {
    const row = confusions.get(asked) ?? new Map<LearnKanaKey, number>();
    const count = Math.max(0, (row.get(given) ?? 0) + delta);
    if (count > 0) row.set(given, count);
    else row.delete(given);
    if (row.size > 0) confusions.set(asked, row);
    else confusions.delete(asked);
  }

  function applyAnswer(a: AnswerEvent): void {
    const key = isWordKey(a.k) ? null : a.k;
    if (key !== null && !items.has(key)) introduce(key, a);

    // Rule 6: outcomes and `observed`, read from the phase before the answer.
    if (key !== null) {
      if (items.get(key)?.phase === 'learned' && a.task === 'recall') {
        learner.observed += ADAPT_RATE * ((a.ok ? 1 : 0) - learner.observed);
        pushKept(learner.outcomes.review, a.ok, OUTCOMES_KEPT);
      } else {
        pushKept(learner.outcomes.learning, a.ok, OUTCOMES_KEPT);
      }
    }

    const day = dayOf(a);
    const learned = (k: LearnKanaKey): boolean => items.get(k)?.phase === 'learned';
    for (const effect of effectsOf(a, targetMs, learned)) {
      if (effect.kind === 'confusion') {
        addConfusion(effect.asked, effect.given, effect.delta);
        continue;
      }
      const item = items.get(effect.key);
      if (item === undefined) continue;
      const elapsed = Math.max(0, a.at - item.lastAt) / DAY_MS;
      let next: ItemState = {
        ...item,
        memory: nextMemory(item.memory, effect.grade, elapsed, day === item.lastDay),
        lastAt: a.at,
        lastDay: day,
      };
      if (effect.main) next = settle(next, a, effect.grade);
      items.set(effect.key, next);
    }
  }

  /** Rule 8: the phase and the streak of the kana the task asked. */
  function settle(item: ItemState, a: AnswerEvent, grade: number): ItemState {
    let { phase, streak } = item;
    if (grade === 1) {
      phase = 'learning';
      streak = 0;
    } else if (phase === 'learning' && a.task === 'recall' && a.ok) {
      streak += 1;
    }
    if (phase === 'learning' && streak >= recallsToLearn(state)) phase = 'learned';
    return { ...item, phase, streak, lastTask: learner.tasks };
  }

  const fold: Fold = {
    apply(event) {
      const key = eventKey(event);
      if (data.seen.has(key)) return 'duplicate';
      if (data.last !== null && compareEvents(event, data.last) <= 0) return 'out-of-order';
      data.seen.add(key);
      data.last = { at: event.at, dev: event.dev, n: event.n };

      if (event.t === 'start') {
        learner.tz[event.dev] = event.tz;
      } else if (event.t === 'intro') {
        if (!ITEMS.has(event.k)) {
          data.ignored += 1;
        } else {
          noteTask(event.at);
          if (!items.has(event.k)) introduce(event.k, event);
          learner.tasks += 1;
          learner.lastTaskAt = event.at;
        }
      } else if (event.t === 'answer') {
        if (!isWordKey(event.k) && !ITEMS.has(event.k)) {
          data.ignored += 1;
        } else {
          noteTask(event.at);
          applyAnswer(event);
          learner.tasks += 1;
          learner.lastTaskAt = event.at;
        }
      }
      return 'applied';
    },
    state,
    get last() {
      return data.last;
    },
    get ignored() {
      return data.ignored;
    },
    snapshot() {
      const copy = copyData(data);
      return {
        state: { items: copy.items, learner: copy.learner, confusions: copy.confusions, targetMs },
      };
    },
    clone(over = {}) {
      return build(copyData(data), { ...options, ...over });
    },
  };
  return fold;
}

export function createFold(options: FoldOptions): Fold {
  return build(emptyData(), options);
}

/** Drops repeated `eventKey`s, sorts by `compareEvents` and applies. */
export function foldLog(events: Iterable<LogEvent>, options: FoldOptions): Fold {
  const unique = new Map<string, LogEvent>();
  for (const e of events) if (!unique.has(eventKey(e))) unique.set(eventKey(e), e);
  const fold = createFold(options);
  for (const e of [...unique.values()].sort(compareEvents)) fold.apply(e);
  return fold;
}
