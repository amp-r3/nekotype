import type { EventId, LearnKanaKey, LogEvent, AnswerEvent, Track } from '@nekotype/shared/types';
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
import type { Grade, Memory } from './fsrs';
import { eachEffect } from './grade';
import type { EffectSink } from './grade';
import { ITEMS, isWordKey } from './items';
import { recallsToLearn } from './learner';
import { compareEvents, eventKey, localDay } from './order';
import { copyStats, emptyStats, liveStats, noteAnswer, noteSession, snapshotStats } from './stats';
import type { LogStats, StatsData } from './stats';

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

export type FoldOptions = { readonly targetMs: number; readonly stats: boolean };
export type ApplyResult = 'applied' | 'duplicate' | 'out-of-order';

export interface Fold {
  /** Applies an event that sorts after the last one applied; otherwise changes nothing. */
  apply(event: LogEvent): ApplyResult;
  /** Live and read-only: valid until the next `apply`. The planner reads it. */
  readonly state: ModelState;
  /** Live statistics (D7); null when `stats` is false. */
  readonly stats: LogStats | null;
  readonly last: EventId | null;
  /** Events skipped by rule 1. */
  readonly ignored: number;
  /** Copies that later applies do not change, for signals: O(kana + days). */
  snapshot(): { readonly state: ModelState; readonly stats: LogStats | null };
  /** An independent fold with the same state; the forecast clones with `stats: false`. */
  clone(options?: Partial<FoldOptions>): Fold;
}

const OBSERVED_START = 0.9;

/**
 * The last `max` values pushed, oldest first. A push moves the start instead of shifting the list
 * (the long lists take a push on every task and are read only now and then); the list is cut when
 * read, and kept until the next push.
 */
type Kept<T> = { push(value: T): void; list(): readonly T[] };

function kept<T>(max: number, from: readonly T[]): Kept<T> {
  let values = [...from];
  let start = 0;
  let list: readonly T[] | null = null;
  return {
    push(value) {
      values.push(value);
      if (values.length - start > max) {
        start = values.length - max;
        if (start >= max) {
          values = values.slice(start);
          start = 0;
        }
      }
      list = null;
    },
    list() {
      list ??= values.slice(start);
      return list;
    },
  };
}

/** The lists of the learner that take a push on every task. */
type LearnerLists = {
  readonly taskMs: Kept<number>;
  readonly learning: Kept<boolean>;
  readonly review: Kept<boolean>;
};

type MutableLearner = {
  tasks: number;
  lastTaskAt: number | null;
  sittingStart: number | null;
  gaps: number[];
  sittings: number[];
  /** Read from `LearnerLists`. */
  readonly taskMs: readonly number[];
  observed: number;
  /** Read from `LearnerLists`. */
  readonly outcomes: { readonly learning: readonly boolean[]; readonly review: readonly boolean[] };
  tz: Record<string, number>;
};

/**
 * The `n`s of one device, as a set of numbers would hold them: a bit per whole number below
 * SEEN_BITS (`n` is 1, 2, 3, … per device), a set for any other number. A set of every `n`
 * costs a fifth of the fold in Chromium.
 */
type SeenNumbers = { bits: Uint8Array; other: Set<number> | null };

const SEEN_BITS = 2 ** 22;

function isSmall(n: number): boolean {
  return Number.isInteger(n) && n >= 0 && n < SEEN_BITS;
}

function emptySeen(): SeenNumbers {
  return { bits: new Uint8Array(1024), other: null };
}

function copySeen(s: SeenNumbers): SeenNumbers {
  return { bits: s.bits.slice(), other: s.other === null ? null : new Set(s.other) };
}

function hasSeen(s: SeenNumbers, n: number): boolean {
  if (!isSmall(n)) return s.other?.has(n) ?? false;
  return ((s.bits[n >>> 3] ?? 0) & (1 << (n & 7))) !== 0;
}

function addSeen(s: SeenNumbers, n: number): void {
  if (!isSmall(n)) {
    (s.other ??= new Set()).add(n);
    return;
  }
  const at = n >>> 3;
  if (at >= s.bits.length) {
    const grown = new Uint8Array(Math.max(at + 1, s.bits.length * 2));
    grown.set(s.bits);
    s.bits = grown;
  }
  s.bits[at] = (s.bits[at] ?? 0) | (1 << (n & 7));
}

type Data = {
  readonly items: Map<LearnKanaKey, ItemState>;
  readonly learner: MutableLearner;
  readonly lists: LearnerLists;
  readonly confusions: Map<LearnKanaKey, Map<LearnKanaKey, number>>;
  /** Per `dev`, the `n` of every event applied (numbers are cheaper than `eventKey` strings). */
  readonly seen: Map<string, SeenNumbers>;
  /** Null when the fold keeps no statistics. */
  readonly stats: StatsData | null;
  last: EventId | null;
  ignored: number;
};

function pushKept<T>(list: T[], value: T, max: number): void {
  list.push(value);
  while (list.length > max) list.shift();
}

const START: LearnerState = {
  tasks: 0,
  lastTaskAt: null,
  sittingStart: null,
  gaps: [],
  sittings: [],
  taskMs: [],
  observed: OBSERVED_START,
  outcomes: { learning: [], review: [] },
  tz: {},
};

/** A fold's learner from `from` (copied) and its lists. */
function learnerOf(from: LearnerState): { learner: MutableLearner; lists: LearnerLists } {
  const lists: LearnerLists = {
    taskMs: kept(TASK_MS_KEPT, from.taskMs),
    learning: kept(OUTCOMES_KEPT, from.outcomes.learning),
    review: kept(OUTCOMES_KEPT, from.outcomes.review),
  };
  const learner: MutableLearner = {
    tasks: from.tasks,
    lastTaskAt: from.lastTaskAt,
    sittingStart: from.sittingStart,
    gaps: [...from.gaps],
    sittings: [...from.sittings],
    get taskMs() {
      return lists.taskMs.list();
    },
    observed: from.observed,
    outcomes: {
      get learning() {
        return lists.learning.list();
      },
      get review() {
        return lists.review.list();
      },
    },
    tz: { ...from.tz },
  };
  return { learner, lists };
}

/** A plain copy that later applies do not change. */
function copyLearner(l: LearnerState): LearnerState {
  return {
    tasks: l.tasks,
    lastTaskAt: l.lastTaskAt,
    sittingStart: l.sittingStart,
    gaps: [...l.gaps],
    sittings: [...l.sittings],
    taskMs: [...l.taskMs],
    observed: l.observed,
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

/** `stats`: whether the copy keeps statistics (empty ones when `d` had none). */
function copyData(d: Data, stats: boolean): Data {
  return {
    items: new Map(d.items),
    ...learnerOf(d.learner),
    confusions: copyConfusions(d.confusions),
    seen: new Map([...d.seen].map(([dev, ns]) => [dev, copySeen(ns)])),
    stats: stats ? (d.stats === null ? emptyStats() : copyStats(d.stats)) : null,
    last: d.last,
    ignored: d.ignored,
  };
}

function emptyData(stats: boolean): Data {
  return {
    items: new Map(),
    ...learnerOf(START),
    confusions: new Map(),
    seen: new Map(),
    stats: stats ? emptyStats() : null,
    last: null,
    ignored: 0,
  };
}

/** A key and its item; one per key. */
export type ItemSlot = {
  readonly key: LearnKanaKey;
  readonly item: ItemState;
  /** The key's track in `ITEMS`; null for a key that is not there. */
  readonly track: Track | null;
};

type KeptSlot = { readonly key: LearnKanaKey; item: ItemState; readonly track: Track | null };

function newSlot(key: LearnKanaKey, item: ItemState): KeptSlot {
  return { key, item, track: ITEMS.get(key)?.track ?? null };
}

/**
 * The items of a map in its order, as an array: the planner reads every item on every task (a
 * forecast plays up to 18,000 tasks), and an array is cheaper to walk than a map. `slotOf` finds
 * a key's slot.
 */
export type ItemSlots = {
  readonly slots: readonly ItemSlot[];
  readonly slotOf: (key: LearnKanaKey) => ItemSlot | undefined;
};

/** The slots a fold keeps beside the map it owns, changed with every change of the map. */
const KEPT_SLOTS = new WeakMap<ReadonlyMap<LearnKanaKey, ItemState>, ItemSlots>();

/** The slots of `items`: the ones its fold keeps, or new ones for any other map. Not part of the package's index. */
export function itemSlots(items: ReadonlyMap<LearnKanaKey, ItemState>): ItemSlots {
  const kept = KEPT_SLOTS.get(items);
  if (kept !== undefined) return kept;
  const slots = [...items].map(([key, item]) => newSlot(key, item));
  return { slots, slotOf: (key) => slots.find((slot) => slot.key === key) };
}

function build(data: Data, options: FoldOptions): Fold {
  const { targetMs } = options;
  const { items, learner, lists, confusions } = data;
  const state: ModelState = { items, learner, confusions, targetMs };

  // The map's slots, in its order: `introduce` adds a key to both, `grade` changes both.
  const slots: KeptSlot[] = [];
  const slotByKey = new Map<LearnKanaKey, KeptSlot>();
  for (const [key, item] of items) {
    const slot = newSlot(key, item);
    slots.push(slot);
    slotByKey.set(key, slot);
  }
  KEPT_SLOTS.set(items, { slots, slotOf: (key) => slotByKey.get(key) });

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
      lists.taskMs.push(gap);
    }
  }

  /** Rule 4 for a kana that is new: never called for one in the map. */
  function introduce(key: LearnKanaKey, e: EventId): void {
    const item: ItemState = {
      phase: 'learning',
      memory: firstMemory(1),
      lastAt: e.at,
      lastDay: dayOf(e),
      streak: 0,
      lastTask: learner.tasks,
    };
    const slot = newSlot(key, item);
    slots.push(slot);
    slotByKey.set(key, slot);
    items.set(key, item);
  }

  function addConfusion(asked: LearnKanaKey, given: LearnKanaKey, delta: 1 | -1): void {
    const row = confusions.get(asked) ?? new Map<LearnKanaKey, number>();
    const count = Math.max(0, (row.get(given) ?? 0) + delta);
    if (count > 0) row.set(given, count);
    else row.delete(given);
    if (row.size > 0) confusions.set(asked, row);
    else confusions.delete(asked);
  }

  const learned = (k: LearnKanaKey): boolean => items.get(k)?.phase === 'learned';

  // The answer being applied: what the sink's grades read.
  let answerAt = 0;
  let answerDay = 0;
  let correctRecall = false;

  /** Rule 7, and rule 8 for the main kana: one new `ItemState` per grade. */
  function grade(key: LearnKanaKey, g: Grade, main: boolean): void {
    const slot = slotByKey.get(key);
    if (slot === undefined) return;
    const { item } = slot;
    const elapsed = Math.max(0, answerAt - item.lastAt) / DAY_MS;
    const memory = nextMemory(item.memory, g, elapsed, answerDay === item.lastDay);
    let { phase, streak, lastTask } = item;
    if (main) {
      // Rule 8: the phase and the streak of the kana the task asked.
      if (g === 1) {
        phase = 'learning';
        streak = 0;
      } else if (phase === 'learning' && correctRecall) {
        streak += 1;
      }
      if (phase === 'learning' && streak >= recallsToLearn(state)) phase = 'learned';
      lastTask = learner.tasks;
    }
    const next: ItemState = {
      phase,
      memory,
      lastAt: answerAt,
      lastDay: answerDay,
      streak,
      lastTask,
    };
    slot.item = next;
    items.set(key, next);
  }

  const sink: EffectSink = { grade, confusion: addConfusion };

  /** `key`: the kana asked and `track` its track; both null for a word. */
  function applyAnswer(a: AnswerEvent, key: LearnKanaKey | null, track: Track | null): void {
    if (key !== null && !items.has(key)) introduce(key, a);

    // Rule 6: outcomes and `observed`, read from the phase before the answer.
    if (key !== null) {
      if (items.get(key)?.phase === 'learned' && a.task === 'recall') {
        learner.observed += ADAPT_RATE * ((a.ok ? 1 : 0) - learner.observed);
        lists.review.push(a.ok);
      } else {
        lists.learning.push(a.ok);
      }
    }

    const day = dayOf(a);
    if (data.stats !== null) noteAnswer(data.stats, a, key, track, day);
    answerAt = a.at;
    answerDay = day;
    correctRecall = a.task === 'recall' && a.ok;
    eachEffect(a, targetMs, learned, sink);
  }

  const fold: Fold = {
    apply(event) {
      const ns = data.seen.get(event.dev);
      if (ns !== undefined && hasSeen(ns, event.n)) return 'duplicate';
      if (data.last !== null && compareEvents(event, data.last) <= 0) return 'out-of-order';
      if (ns === undefined) {
        const added = emptySeen();
        addSeen(added, event.n);
        data.seen.set(event.dev, added);
      } else {
        addSeen(ns, event.n);
      }
      data.last = { at: event.at, dev: event.dev, n: event.n };

      if (event.t === 'start') {
        learner.tz[event.dev] = event.tz;
        if (data.stats !== null) noteSession(data.stats, 'start');
      } else if (event.t === 'end') {
        if (data.stats !== null) noteSession(data.stats, 'end');
      } else if (event.t === 'intro') {
        if (!ITEMS.has(event.k)) {
          data.ignored += 1;
        } else {
          noteTask(event.at);
          if (!items.has(event.k)) introduce(event.k, event);
          learner.tasks += 1;
          learner.lastTaskAt = event.at;
        }
      } else {
        const key = isWordKey(event.k) ? null : event.k;
        const track = key === null ? null : (ITEMS.get(key)?.track ?? null);
        if (key !== null && track === null) {
          data.ignored += 1;
        } else {
          noteTask(event.at);
          applyAnswer(event, key, track);
          learner.tasks += 1;
          learner.lastTaskAt = event.at;
        }
      }
      return 'applied';
    },
    state,
    get stats() {
      return data.stats === null ? null : liveStats(data.stats);
    },
    get last() {
      return data.last;
    },
    get ignored() {
      return data.ignored;
    },
    snapshot() {
      return {
        state: {
          items: new Map(items),
          learner: copyLearner(learner),
          confusions: copyConfusions(confusions),
          targetMs,
        },
        stats: data.stats === null ? null : snapshotStats(data.stats),
      };
    },
    clone(over = {}) {
      const next = { ...options, ...over };
      return build(copyData(data, next.stats), next);
    },
  };
  return fold;
}

export function createFold(options: FoldOptions): Fold {
  return build(emptyData(options.stats), options);
}

function isList(events: Iterable<LogEvent>): events is readonly LogEvent[] {
  return Array.isArray(events);
}

/** Drops repeated `eventKey`s, sorts by `compareEvents` and applies. */
export function foldLog(events: Iterable<LogEvent>, options: FoldOptions): Fold {
  const list = isList(events) ? events : [...events];
  const fold = createFold(options);
  // A log that is already in strict order (a stored log is) has no repeats and needs no sort.
  let ordered = true;
  let previous: LogEvent | null = null;
  for (const e of list) {
    if (previous !== null && compareEvents(previous, e) >= 0) {
      ordered = false;
      break;
    }
    previous = e;
  }
  if (ordered) {
    for (const e of list) fold.apply(e);
    return fold;
  }
  const unique = new Map<string, LogEvent>();
  for (const e of list) if (!unique.has(eventKey(e))) unique.set(eventKey(e), e);
  for (const e of [...unique.values()].sort(compareEvents)) fold.apply(e);
  return fold;
}

/**
 * A fold that starts from a state (a copy; the state is not changed): the forecast plays it
 * forward. It has no statistics, no applied keys and no last event, so any event applies. Not part
 * of the package's index.
 */
export function foldFromState(state: ModelState, options: FoldOptions): Fold {
  const data: Data = {
    items: new Map(state.items),
    ...learnerOf(state.learner),
    confusions: copyConfusions(state.confusions),
    seen: new Map(),
    stats: null,
    last: null,
    ignored: 0,
  };
  return build(data, options);
}
