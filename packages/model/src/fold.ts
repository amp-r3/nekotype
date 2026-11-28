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
import { ITEMS, isRuleKey, isWordKey } from './items';
import type { KanaItem } from './items';
import { recallsToLearn } from './learner';
import { compareEvents, eventKey, localDay } from './order';
import { allDevices, countsForPace, isTimed, lineOf, logMs, notePace, oneDevice } from './pace';
import type { LivePace, Pace, TimedTask } from './pace';
import {
  copyStats,
  emptyStats,
  liveStats,
  noteAnswer,
  noteIntro,
  noteSession,
  snapshotStats,
} from './stats';
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
  /**
   * The paces of ADR 115, keyed by `oneDevice(task, dev)` and `allDevices(task)`: what separates a
   * good timed answer from a hard one.
   */
  readonly pace: ReadonlyMap<string, Pace>;
};

export type ModelState = {
  readonly items: ReadonlyMap<LearnKanaKey, ItemState>;
  readonly learner: LearnerState;
  /** asked → given → count; only counts above 0. */
  readonly confusions: ReadonlyMap<LearnKanaKey, ReadonlyMap<LearnKanaKey, number>>;
};

export type FoldOptions = {
  readonly stats: boolean;
  /**
   * The line in ms of a timed answer instead of its pace: the forecast's plays grade every
   * correct answer good, and the simulator grades by rules of its own. The pace still follows
   * the answers.
   */
  readonly line?: (answer: AnswerEvent) => number;
};
export type ApplyResult = 'applied' | 'duplicate' | 'out-of-order';

export interface Fold {
  /** Applies an event that sorts after the last one applied; otherwise changes nothing. */
  apply(event: LogEvent): ApplyResult;
  /** Live and read-only: valid until the next `apply`. The planner reads it. */
  readonly state: ModelState;
  /** Live statistics (D7), valid until the next `apply` as `state` is; null when `stats` is false. */
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
 * read, and kept until the next push. A class, as the fold is: see `LiveFold`.
 */
class Kept<T> {
  private readonly max: number;
  private values: T[];
  private start = 0;
  private cut: readonly T[] | null = null;

  constructor(max: number, from: readonly T[]) {
    this.max = max;
    this.values = [...from];
  }

  push(value: T): void {
    this.values.push(value);
    if (this.values.length - this.start > this.max) {
      this.start = this.values.length - this.max;
      if (this.start >= this.max) {
        this.values = this.values.slice(this.start);
        this.start = 0;
      }
    }
    this.cut = null;
  }

  list(): readonly T[] {
    this.cut ??= this.values.slice(this.start);
    return this.cut;
  }
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
  pace: Map<string, LivePace>;
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
  /** The last event applied, kept as it came: `Fold.last` copies its identity when asked. */
  last: LogEvent | null;
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
  pace: new Map(),
};

/** A fold's learner from `from` (copied) and its lists. */
function learnerOf(from: LearnerState): { learner: MutableLearner; lists: LearnerLists } {
  const lists: LearnerLists = {
    taskMs: new Kept(TASK_MS_KEPT, from.taskMs),
    learning: new Kept(OUTCOMES_KEPT, from.outcomes.learning),
    review: new Kept(OUTCOMES_KEPT, from.outcomes.review),
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
    pace: new Map([...from.pace].map(([key, p]) => [key, { level: p.level, count: p.count }])),
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
    pace: new Map([...l.pace].map(([key, p]) => [key, { level: p.level, count: p.count }])),
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

/**
 * The fold. A class rather than closures: every fold shares one `apply` and one `grade`, so the
 * calls to them (`foldLog`, the forecast's plays, `eachEffect`) stay monomorphic; a closure per
 * fold made the optimized `foldLog` give up on each new fold. It is also the sink of `eachEffect`.
 */
class LiveFold implements Fold, EffectSink {
  readonly state: ModelState;
  private readonly data: Data;
  private readonly options: FoldOptions;
  // The map's slots, in its order: `introduce` adds a key to both, `grade` changes both.
  private readonly slots: KeptSlot[] = [];
  private readonly slotByKey = new Map<LearnKanaKey, KeptSlot>();
  // The zone of the last `dev` asked: a log is long runs of one device, and a session start
  // forgets it.
  private zoneDev: string | null = null;
  private zone = 0;
  // The `n`s of the last `dev` applied, for the same reason.
  private seenDev: string | null = null;
  private seenOf: SeenNumbers | undefined = undefined;
  // `recallsToLearn` reads only `observed`, which moves on reviews alone.
  private recallsObserved = Number.NaN;
  private recalls = 0;
  // The answer being applied: what the grades read. `answerSlot` is the slot of the kana it asked,
  // the only one a main grade names.
  private answerAt = 0;
  private answerDay = 0;
  private correctRecall = false;
  private answerSlot: KeptSlot | undefined = undefined;
  // The paces of the last timed task and device answered: a log is long runs of one device.
  private paceTask: TimedTask | null = null;
  private paceDev: string | null = null;
  private paceOwn: LivePace | undefined = undefined;
  private paceAll: LivePace | undefined = undefined;

  constructor(data: Data, options: FoldOptions) {
    this.data = data;
    this.options = options;
    const { items, learner, confusions } = data;
    this.state = { items, learner, confusions };
    const { slots, slotByKey } = this;
    for (const [key, item] of items) {
      const slot = newSlot(key, item);
      slots.push(slot);
      slotByKey.set(key, slot);
    }
    KEPT_SLOTS.set(items, { slots, slotOf: (key) => slotByKey.get(key) });
  }

  apply(event: LogEvent): ApplyResult {
    const { data } = this;
    const { learner } = data;
    const ns = this.seenNumbers(event.dev);
    if (ns !== undefined && hasSeen(ns, event.n)) return 'duplicate';
    if (data.last !== null && compareEvents(event, data.last) <= 0) return 'out-of-order';
    if (ns === undefined) {
      const added = emptySeen();
      addSeen(added, event.n);
      data.seen.set(event.dev, added);
      this.seenDev = event.dev;
      this.seenOf = added;
    } else {
      addSeen(ns, event.n);
    }
    data.last = event;

    if (event.t === 'start') {
      learner.tz[event.dev] = event.tz;
      this.zoneDev = null;
      if (data.stats !== null) noteSession(data.stats, 'start');
    } else if (event.t === 'end') {
      if (data.stats !== null) noteSession(data.stats, 'end');
    } else if (event.t === 'intro') {
      const kana = isRuleKey(event.k) ? undefined : ITEMS.get(event.k);
      if (kana === undefined) {
        data.ignored += 1;
      } else {
        this.noteTask(event.at);
        if (!this.slotByKey.has(kana.key)) this.introduce(kana.key, event);
        learner.tasks += 1;
        learner.lastTaskAt = event.at;
      }
    } else {
      const kana = isWordKey(event.k) || isRuleKey(event.k) ? undefined : ITEMS.get(event.k);
      if (kana === undefined && !isWordKey(event.k)) {
        data.ignored += 1;
      } else {
        this.noteTask(event.at);
        this.applyAnswer(event, kana);
        learner.tasks += 1;
        learner.lastTaskAt = event.at;
      }
    }
    return 'applied';
  }

  get stats(): LogStats | null {
    return this.data.stats === null ? null : liveStats(this.data.stats);
  }

  get last(): EventId | null {
    const { last } = this.data;
    return last === null ? null : { at: last.at, dev: last.dev, n: last.n };
  }

  get ignored(): number {
    return this.data.ignored;
  }

  snapshot(): { readonly state: ModelState; readonly stats: LogStats | null } {
    const { data } = this;
    return {
      state: {
        items: new Map(data.items),
        learner: copyLearner(data.learner),
        confusions: copyConfusions(data.confusions),
      },
      stats: data.stats === null ? null : snapshotStats(data.stats),
    };
  }

  clone(over: Partial<FoldOptions> = {}): Fold {
    const next = { ...this.options, ...over };
    return new LiveFold(copyData(this.data, next.stats), next);
  }

  /** Rule 7, and rule 8 for the main kana: one new `ItemState` per grade. */
  grade(key: LearnKanaKey, g: Grade, main: boolean): void {
    const slot = main ? this.answerSlot : this.slotByKey.get(key);
    if (slot === undefined) return;
    const { item } = slot;
    const elapsed = Math.max(0, this.answerAt - item.lastAt) / DAY_MS;
    const memory = nextMemory(item.memory, g, elapsed, this.answerDay === item.lastDay);
    let { phase, streak, lastTask } = item;
    if (main) {
      // Rule 8: the phase and the streak of the kana the task asked.
      if (g === 1) {
        phase = 'learning';
        streak = 0;
      } else if (phase === 'learning' && this.correctRecall) {
        streak += 1;
      }
      if (phase === 'learning' && streak >= this.recallsNow()) phase = 'learned';
      lastTask = this.data.learner.tasks;
    }
    const next: ItemState = {
      phase,
      memory,
      lastAt: this.answerAt,
      lastDay: this.answerDay,
      streak,
      lastTask,
    };
    slot.item = next;
    this.data.items.set(slot.key, next);
  }

  confusion(asked: LearnKanaKey, given: LearnKanaKey, delta: 1 | -1): void {
    const { confusions } = this.data;
    const row = confusions.get(asked) ?? new Map<LearnKanaKey, number>();
    const count = Math.max(0, (row.get(given) ?? 0) + delta);
    if (count > 0) row.set(given, count);
    else row.delete(given);
    if (row.size > 0) confusions.set(asked, row);
    else confusions.delete(asked);
  }

  learned(key: LearnKanaKey): boolean {
    return this.data.items.get(key)?.phase === 'learned';
  }

  private dayOf(e: EventId): number {
    if (e.dev !== this.zoneDev) {
      this.zone = this.data.learner.tz[e.dev] ?? 0;
      this.zoneDev = e.dev;
    }
    return localDay(e.at, this.zone);
  }

  private seenNumbers(dev: string): SeenNumbers | undefined {
    if (dev !== this.seenDev) {
      this.seenOf = this.data.seen.get(dev);
      this.seenDev = dev;
    }
    return this.seenOf;
  }

  private recallsNow(): number {
    const { observed } = this.data.learner;
    if (observed !== this.recallsObserved) {
      this.recalls = recallsToLearn(this.state);
      this.recallsObserved = observed;
    }
    return this.recalls;
  }

  /** Rule 3: the learner's clock moves on every task. */
  private noteTask(at: number): void {
    const { learner } = this.data;
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
      this.data.lists.taskMs.push(gap);
    }
  }

  /** Rule 4 for a kana that is new: never called for one in the map. */
  private introduce(key: LearnKanaKey, e: EventId): KeptSlot {
    const item: ItemState = {
      phase: 'learning',
      memory: firstMemory(1),
      lastAt: e.at,
      lastDay: this.dayOf(e),
      streak: 0,
      lastTask: this.data.learner.tasks,
    };
    const slot = newSlot(key, item);
    this.slots.push(slot);
    this.slotByKey.set(key, slot);
    this.data.items.set(key, item);
    if (this.data.stats !== null) noteIntro(this.data.stats, key);
    return slot;
  }

  /** `kana`: the entry of the kana asked; undefined for a word. */
  private applyAnswer(a: AnswerEvent, kana: KanaItem | undefined): void {
    const { data } = this;
    const { learner, lists } = data;
    let slot: KeptSlot | undefined;
    if (kana !== undefined) {
      slot = this.slotByKey.get(kana.key) ?? this.introduce(kana.key, a);
      // Rule 6: outcomes and `observed`, read from the phase before the answer.
      if (slot.item.phase === 'learned' && a.task === 'recall') {
        learner.observed += ADAPT_RATE * ((a.ok ? 1 : 0) - learner.observed);
        lists.review.push(a.ok);
      } else {
        lists.learning.push(a.ok);
      }
    }

    const day = this.dayOf(a);
    if (data.stats !== null) {
      noteAnswer(data.stats, a, kana?.key ?? null, kana?.track ?? null, day);
    }
    this.answerAt = a.at;
    this.answerDay = day;
    this.correctRecall = a.task === 'recall' && a.ok;
    this.answerSlot = slot;
    const { task } = a;
    if (!isTimed(task)) {
      eachEffect(a, Number.POSITIVE_INFINITY, this, kana);
      return;
    }
    // ADR 115: the line is the pace before the answer; a correct answer without a hint moves it.
    this.lookUpPaces(task, a.dev);
    const line = this.options.line?.(a) ?? lineOf(this.paceOwn, this.paceAll);
    eachEffect(a, line, this, kana);
    if (countsForPace(a)) {
      const x = logMs(a.ms);
      notePace((this.paceOwn ??= this.newPace(oneDevice(task, a.dev))), x);
      notePace((this.paceAll ??= this.newPace(allDevices(task))), x);
    }
  }

  private lookUpPaces(task: TimedTask, dev: string): void {
    if (task === this.paceTask && dev === this.paceDev) return;
    const { pace } = this.data.learner;
    this.paceOwn = pace.get(oneDevice(task, dev));
    this.paceAll = pace.get(allDevices(task));
    this.paceTask = task;
    this.paceDev = dev;
  }

  private newPace(key: string): LivePace {
    const pace: LivePace = { level: 0, count: 0 };
    this.data.learner.pace.set(key, pace);
    return pace;
  }
}

export function createFold(options: FoldOptions): Fold {
  return new LiveFold(emptyData(options.stats), options);
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
  return new LiveFold(data, options);
}
