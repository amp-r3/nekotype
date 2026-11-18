import { computed, effect, signal, untracked } from '@preact/signals';
import type { ReadonlySignal } from '@preact/signals';
import type {
  Clock,
  Counters,
  LearnDelta,
  LearnKanaKey,
  LearnState,
  RecallAnswer,
  Scheduler,
  TimeoutHandle,
} from '@nekotype/shared/types';
import {
  RECENT_ANSWERS,
  addCounters,
  decayLearnStat,
  isCounters,
  isLearnState,
  isObject,
  mergeLearn,
} from '@nekotype/shared/runtime';
import type { ChangeChannel, ChannelMessage, Db } from '@/shared/lib';
import {
  DELTA_STORE,
  META_STORE,
  changeChannel,
  defaultClock,
  defaultScheduler,
  getDatabase,
  readWithSyncBase,
  reportWriteFailure,
} from '@/shared/lib';
import { K_WINDOW, intervalsOf, recallAnswerTime, typingK } from '../lib/answer-time';
import type { Keystroke } from '../lib/answer-time';
import { addRecallTime } from '../lib/buckets';
import { reviewEntry } from '../lib/boxes';
import { localDay } from '../lib/day';
import { addActiveDay } from '../lib/streak';
import { trackOfKey } from '../lib/tracks';
import {
  emptyDelta,
  evaluateBoxes,
  evaluateUnlocking,
  initialCounters,
  initialLearnState,
  learnOrder,
  unlockDelta,
} from '../lib/state';

const DELTA_KEY = 'learn';
const INTERVALS_KEY = 'typingIntervals';

export type LearnStatus = 'loading' | 'ready' | 'error';

export type LearnStoreDeps = {
  /** The database; asked for when needed, so a reset works before the store is loaded. */
  readonly db: () => Promise<Db>;
  readonly clock: Clock;
  readonly scheduler: Scheduler;
  /** The target answer time of confidence, read at each evaluation: a change applies at once. */
  readonly targetMs: () => number;
  /** Other tabs: posted after a successful write; their messages make the store read again. */
  readonly channel?: ChangeChannel;
  /** A write failed (quota, a closed connection). */
  readonly onWriteFailed?: () => void;
};

export type RecallInput = {
  readonly key: LearnKanaKey;
  /** The keys of the answer, timed from showing the task. */
  readonly keystrokes: readonly Keystroke[];
  /** No rejected key and no Esc. */
  readonly ok: boolean;
  /** A task of a review session: only a review moves the kana's box. */
  readonly review?: boolean;
};

export type RecognitionInput = {
  readonly key: LearnKanaKey;
  /** The kana chosen; a wrong choice is a mixup of `key`. */
  readonly chosen: LearnKanaKey;
};

export interface LearnStore {
  readonly state: ReadonlySignal<LearnState>;
  readonly counters: ReadonlySignal<Counters>;
  /**
   * `loading` until the stored record has been read; `ready` once it has (or there was none, or it
   * failed validation: the initial state is taken, ADR 061); `error` when reading it failed. After an
   * error nothing is written, so the stored record is never replaced by the initial state.
   */
  readonly status: ReadonlySignal<LearnStatus>;
  /** `status` is `ready`. */
  readonly ready: ReadonlySignal<boolean>;
  /** Reads the state once; later calls return the same promise. Never rejects. */
  init: () => Promise<void>;
  /** Reads the state again after an error. Never rejects. */
  retry: () => Promise<void>;
  /** An introduction: creates the kana's entry in box 0. It is not an answer. */
  introduce: (key: LearnKanaKey) => void;
  /** Records a recall answer; returns its answer time. */
  recordRecall: (input: RecallInput) => number;
  recordRecognition: (input: RecognitionInput) => void;
  /** `started`: a session's first task; `finished`: a session that reached its summary. */
  countSession: (kind: 'started' | 'finished') => void;
  /** Unlocks and moves boxes for the current target answer time; for a changed setting. */
  reevaluate: () => void;
  /** Writes a pending change now, or waits for the write in progress. Never rejects. */
  flush: () => Promise<void>;
  /** "Reset progress": clears the learning state and its stored record. */
  reset: () => Promise<void>;
}

function isIntervals(value: unknown): value is number[] {
  return Array.isArray(value) && value.every((v) => typeof v === 'number' && Number.isFinite(v));
}

/** The changes since the last batch: what `delta/learn` holds, and what a store has not written yet. */
type LearnChanges = { readonly learn: LearnDelta; readonly counters: Counters };

const noChanges = (): LearnChanges => ({ learn: emptyDelta(), counters: initialCounters() });

function readChanges(value: unknown): LearnChanges | null {
  if (isObject(value) && isLearnState(value['learn']) && isCounters(value['counters'])) {
    return { learn: value['learn'], counters: value['counters'] };
  }
  return null;
}

export function createLearnStore(deps: LearnStoreDeps): LearnStore {
  const state = signal<LearnState>(initialLearnState());
  const counters = signal<Counters>(initialCounters());
  const status = signal<LearnStatus>('loading');
  const ready = computed(() => status.value === 'ready');

  // The view above is the snapshot, the outbox, the stored delta and `unwritten` merged (D18);
  // `unwritten` is what this tab changed since its last write.
  let unwritten: LearnChanges = noChanges();
  const order = learnOrder();
  const mergeDelta = (a: LearnDelta, b: LearnDelta): LearnDelta => mergeLearn(a, b, order);
  let intervals: number[] = [];
  let lastAt = 0;
  let pending: TimeoutHandle | null = null;
  let writing: Promise<void> = Promise.resolve();
  let loading: Promise<void> | null = null;

  // Unlocking and the move from box 0 to box 1 are checked together (learning.md, "Boxes").
  const unlock = (next: LearnState): LearnState =>
    evaluateBoxes(evaluateUnlocking(next, deps.targetMs()), deps.targetMs(), deps.clock.now());

  const write = (): Promise<void> => {
    pending = null;
    // After a failed read the state in memory is not the stored one: writing it would replace the
    // stored record with the initial state.
    if (status.value === 'error') {
      // The answer is shown but not kept: say so, as for any write that fails.
      deps.onWriteFailed?.();
      return writing;
    }
    writing = writing.then(async () => {
      const taken = unwritten;
      unwritten = noChanges();
      const keep = intervals;
      try {
        const db = await deps.db();
        // One transaction merges our changes into the stored delta, so another tab's are kept;
        // the intervals that give K go with it.
        await db.update(
          [{ store: DELTA_STORE, key: DELTA_KEY }],
          ([stored]) => {
            const own = readChanges(stored) ?? noChanges();
            const merged: LearnChanges = {
              learn: mergeDelta(own.learn, taken.learn),
              counters: addCounters(own.counters, taken.counters),
            };
            return [
              { op: 'put', store: DELTA_STORE, key: DELTA_KEY, value: merged },
              { op: 'put', store: META_STORE, key: INTERVALS_KEY, value: keep },
            ];
          },
          [META_STORE],
        );
        deps.channel?.post();
      } catch {
        // The write failed (quota, a closed connection): the changes wait for the next write.
        unwritten = {
          learn: mergeDelta(taken.learn, unwritten.learn),
          counters: addCounters(taken.counters, unwritten.counters),
        };
        deps.onWriteFailed?.();
      }
    });
    return writing;
  };

  // Reads the snapshot, the outbox and the stored delta in one transaction and rebuilds the view
  // from them, our own unwritten changes on top. The whole-state merge runs here only, on load and
  // on a message of another tab, never per answer.
  const rebuild = async (): Promise<void> => {
    const db = await deps.db();
    const { base, values } = await readWithSyncBase(db, [
      { store: DELTA_STORE, key: DELTA_KEY },
      { store: META_STORE, key: INTERVALS_KEY },
    ]);
    const own = readChanges(values[0]) ?? noChanges();
    // The snapshot and the outbox's delta hold `learn` and `counters` as the delta record does.
    const snapshot = readChanges(base.snapshot);
    const sent = readChanges(base.outbox);
    let learn = mergeLearn(initialLearnState(), snapshot?.learn ?? emptyDelta(), order);
    let sum = snapshot?.counters ?? initialCounters();
    if (sent !== null) {
      learn = mergeLearn(learn, sent.learn, order);
      sum = addCounters(sum, sent.counters);
    }
    learn = mergeLearn(learn, own.learn, order);
    sum = addCounters(sum, own.counters);
    state.value = mergeLearn(learn, unwritten.learn, order);
    counters.value = addCounters(sum, unwritten.counters);
    const saved = values[1];
    if (isIntervals(saved)) intervals = saved.slice(-K_WINDOW);
  };

  // Another tab wrote, or reset: read again, in the chain of writes so that it is not read during
  // our own. A reset drops what this tab holds unwritten too.
  const reload = (message: ChannelMessage): Promise<void> => {
    writing = writing
      .then(async () => {
        if (status.value !== 'ready') return;
        if (message === 'reset') unwritten = noChanges();
        await rebuild();
        reevaluate();
      })
      .catch(() => {});
    return writing;
  };
  deps.channel?.listen((message) => {
    void reload(message);
  });

  // The write follows the answer outside the keystroke handler, once for a burst of changes.
  const schedule = (): void => {
    if (pending !== null) return;
    pending = deps.scheduler.setTimeout(() => {
      void write();
    }, 0);
  };

  // `next` is the state after an action, `change` the action as a delta. Unlocking and boxes are
  // evaluated on `next`, and what they change joins the delta.
  const commit = (next: LearnState, change: LearnDelta): void => {
    const evaluated = unlock(next);
    state.value = evaluated;
    unwritten = {
      ...unwritten,
      learn: mergeDelta(unwritten.learn, mergeDelta(change, unlockDelta(next, evaluated))),
    };
    schedule();
  };

  const reevaluate = (): void => {
    if (status.value !== 'ready') return;
    const current = state.value;
    const next = unlock(current);
    if (next === current) return;
    state.value = next;
    unwritten = { ...unwritten, learn: mergeDelta(unwritten.learn, unlockDelta(current, next)) };
    schedule();
  };

  const init = (): Promise<void> => {
    loading ??= (async () => {
      status.value = 'loading';
      try {
        // No record, or one that fails validation: the initial state stands (ADR 061).
        await rebuild();
        status.value = 'ready';
        reevaluate();
      } catch {
        // The read failed: the record may be fine, so it is left alone until a retry succeeds.
        status.value = 'error';
      }
    })();
    return loading;
  };

  return {
    state,
    counters,
    status,
    ready,
    init,

    retry() {
      if (status.value !== 'error') return loading ?? init();
      loading = null;
      return init();
    },

    reevaluate,

    introduce(key) {
      const current = state.value;
      if (current.entries[key] !== undefined) return;
      const entry = { box: 0, dueAt: 0, updatedAt: deps.clock.now() } as const;
      commit(
        { ...current, entries: { ...current.entries, [key]: entry } },
        { ...emptyDelta(), entries: { [key]: entry } },
      );
    },

    recordRecall({ key, keystrokes, ok, review = false }) {
      const ms = recallAnswerTime(keystrokes, typingK(intervals));
      // `at` identifies the answer in a merge, so two answers never share one.
      lastAt = Math.max(deps.clock.now(), lastAt + 1);
      const answer: RecallAnswer = { at: lastAt, ms, ok };
      intervals = [...intervals, ...intervalsOf(keystrokes)].slice(-K_WINDOW);
      const current = state.value;
      const recent = [...(current.recent[key] ?? []), answer].slice(-RECENT_ANSWERS);
      const track = trackOfKey(key);
      const day = localDay(lastAt);
      const entry = current.entries[key];
      const reviewed = review && entry !== undefined ? reviewEntry(entry, ok, lastAt) : null;
      commit(
        {
          ...current,
          entries: reviewed === null ? current.entries : { ...current.entries, [key]: reviewed },
          recent: { ...current.recent, [key]: recent },
          activeDays: addActiveDay(current.activeDays, day),
          recallBuckets: {
            ...current.recallBuckets,
            [track]: addRecallTime(current.recallBuckets[track], day, ms),
          },
        },
        {
          ...emptyDelta(),
          entries: reviewed === null ? {} : { [key]: reviewed },
          recent: { [key]: [answer] },
          activeDays: addActiveDay([], day),
          recallBuckets: { hiragana: {}, katakana: {}, [track]: addRecallTime({}, day, ms) },
        },
      );
      return ms;
    },

    recordRecognition({ key, chosen }) {
      const current = state.value;
      const before = current.stats[key] ?? { recognitions: 0, recognitionErrors: 0, mixups: {} };
      const wrong = chosen !== key;
      const stat = {
        recognitions: before.recognitions + 1,
        recognitionErrors: before.recognitionErrors + (wrong ? 1 : 0),
        mixups: wrong
          ? { ...before.mixups, [chosen]: (before.mixups[chosen] ?? 0) + 1 }
          : before.mixups,
      };
      const day = localDay(deps.clock.now());
      commit(
        {
          ...current,
          stats: { ...current.stats, [key]: decayLearnStat(stat) },
          activeDays: addActiveDay(current.activeDays, day),
        },
        {
          ...emptyDelta(),
          stats: {
            [key]: {
              recognitions: 1,
              recognitionErrors: wrong ? 1 : 0,
              mixups: wrong ? { [chosen]: 1 } : {},
            },
          },
          activeDays: addActiveDay([], day),
        },
      );
    },

    countSession(kind) {
      const bump = (c: Counters): Counters => ({
        ...c,
        [kind]: { ...c[kind], learn: c[kind].learn + 1 },
      });
      counters.value = bump(counters.value);
      unwritten = { ...unwritten, counters: bump(unwritten.counters) };
      schedule();
    },

    async flush() {
      if (pending === null) return writing;
      deps.scheduler.clearTimeout(pending);
      return write();
    },

    async reset() {
      if (pending !== null) deps.scheduler.clearTimeout(pending);
      pending = null;
      unwritten = noChanges();
      state.value = initialLearnState();
      counters.value = initialCounters();
      await writing;
      try {
        const db = await deps.db();
        await db.delete(DELTA_STORE, DELTA_KEY);
        // The record is gone, so there is nothing a later write could replace.
        status.value = 'ready';
        // Other tabs drop what they hold.
        deps.channel?.post('reset');
      } catch {
        // The record could not be deleted; the next write replaces it.
      }
    },
  };
}

let targetMsSource: () => number = () => 1500;

const store = createLearnStore({
  db: getDatabase,
  clock: defaultClock,
  scheduler: defaultScheduler,
  targetMs: () => targetMsSource(),
  channel: changeChannel('nekotype:learn'),
  onWriteFailed: reportWriteFailure,
});

let watching = false;

/** Binds the target answer time (`settings.learn.targetMs`) and loads the state; `/learn` calls it. */
export function initLearn(targetMs: () => number): Promise<void> {
  targetMsSource = targetMs;
  if (!watching) {
    watching = true;
    // A changed target can confirm kana: `untracked` keeps the effect off the state, so it runs on
    // the setting only, not on each answer.
    effect(() => {
      targetMs();
      untracked(() => {
        store.reevaluate();
      });
    });
  }
  return store.init();
}

export const learnState: ReadonlySignal<LearnState> = store.state;
export const learnCounters: ReadonlySignal<Counters> = store.counters;
export const learnStatus: ReadonlySignal<LearnStatus> = store.status;
export const learnReady: ReadonlySignal<boolean> = store.ready;
export const retryLearn = store.retry;
export const introduce = store.introduce;
export const recordRecall = store.recordRecall;
export const recordRecognition = store.recordRecognition;
export const countSession = store.countSession;
export const resetLearning = store.reset;
