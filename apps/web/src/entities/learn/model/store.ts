import { computed, signal } from '@preact/signals';
import type { ReadonlySignal } from '@preact/signals';
import type {
  Clock,
  Counters,
  LearnKanaKey,
  LearnState,
  RecallAnswer,
  Scheduler,
  TimeoutHandle,
} from '@nekotype/shared/types';
import {
  RECENT_ANSWERS,
  decayLearnStat,
  isCounters,
  isLearnState,
  isObject,
} from '@nekotype/shared/runtime';
import type { Db } from '@/shared/lib';
import { defaultClock, defaultScheduler, getDatabase } from '@/shared/lib';
import { K_WINDOW, intervalsOf, recallAnswerTime, typingK } from '../lib/answer-time';
import type { Keystroke } from '../lib/answer-time';
import { addRecallTime } from '../lib/buckets';
import { reviewEntry } from '../lib/boxes';
import { localDay } from '../lib/day';
import { addActiveDay } from '../lib/streak';
import { trackOfKey } from '../lib/tracks';
import { evaluateBoxes, evaluateUnlocking, initialCounters, initialLearnState } from '../lib/state';

const DELTA_STORE = 'delta';
const DELTA_KEY = 'current';
const META_STORE = 'meta';
const INTERVALS_KEY = 'typingIntervals';

export type LearnStatus = 'loading' | 'ready' | 'error';

export type LearnStoreDeps = {
  /** The database; asked for when needed, so a reset works before the store is loaded. */
  readonly db: () => Promise<Db>;
  readonly clock: Clock;
  readonly scheduler: Scheduler;
  /** The target answer time of confidence, read at each evaluation: a change applies at once. */
  readonly targetMs: () => number;
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
  /** Writes a pending change now, or waits for the write in progress. Never rejects. */
  flush: () => Promise<void>;
  /** "Reset progress": clears the learning state and its stored record. */
  reset: () => Promise<void>;
}

function isIntervals(value: unknown): value is number[] {
  return Array.isArray(value) && value.every((v) => typeof v === 'number' && Number.isFinite(v));
}

export function createLearnStore(deps: LearnStoreDeps): LearnStore {
  const state = signal<LearnState>(initialLearnState());
  const counters = signal<Counters>(initialCounters());
  const status = signal<LearnStatus>('loading');
  const ready = computed(() => status.value === 'ready');

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
    if (status.value === 'error') return writing;
    const learn = state.value;
    const stored = counters.value;
    const keep = intervals;
    writing = writing
      .then(async () => {
        const db = await deps.db();
        // One transaction: the state and the intervals that give K change together.
        await db.write([
          { op: 'put', store: DELTA_STORE, key: DELTA_KEY, value: { learn, counters: stored } },
          { op: 'put', store: META_STORE, key: INTERVALS_KEY, value: keep },
        ]);
      })
      .catch(() => {
        // The write failed (quota, a closed connection): the state holds for this page load.
      });
    return writing;
  };

  // The write follows the answer outside the keystroke handler, once for a burst of changes.
  const schedule = (): void => {
    if (pending !== null) return;
    pending = deps.scheduler.setTimeout(() => {
      void write();
    }, 0);
  };

  const commit = (next: LearnState): void => {
    state.value = unlock(next);
    schedule();
  };

  const init = (): Promise<void> => {
    loading ??= (async () => {
      status.value = 'loading';
      try {
        const db = await deps.db();
        const doc = await db.get(DELTA_STORE, DELTA_KEY);
        // No record, or one that fails validation: the initial state stands (ADR 061).
        if (isObject(doc) && isLearnState(doc['learn']) && isCounters(doc['counters'])) {
          state.value = unlock(doc['learn']);
          counters.value = doc['counters'];
        }
        const saved = await db.get(META_STORE, INTERVALS_KEY);
        if (isIntervals(saved)) intervals = saved.slice(-K_WINDOW);
        status.value = 'ready';
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

    introduce(key) {
      const current = state.value;
      if (current.entries[key] !== undefined) return;
      const entry = { box: 0, dueAt: 0, updatedAt: deps.clock.now() } as const;
      commit({ ...current, entries: { ...current.entries, [key]: entry } });
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
      const entries =
        review && entry !== undefined
          ? { ...current.entries, [key]: reviewEntry(entry, ok, lastAt) }
          : current.entries;
      commit({
        ...current,
        entries,
        recent: { ...current.recent, [key]: recent },
        activeDays: addActiveDay(current.activeDays, day),
        recallBuckets: {
          ...current.recallBuckets,
          [track]: addRecallTime(current.recallBuckets[track], day, ms),
        },
      });
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
      commit({
        ...current,
        stats: { ...current.stats, [key]: decayLearnStat(stat) },
        activeDays: addActiveDay(current.activeDays, localDay(deps.clock.now())),
      });
    },

    countSession(kind) {
      const current = counters.value;
      counters.value = {
        ...current,
        [kind]: { ...current[kind], learn: current[kind].learn + 1 },
      };
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
      state.value = initialLearnState();
      counters.value = initialCounters();
      await writing;
      try {
        const db = await deps.db();
        await db.delete(DELTA_STORE, DELTA_KEY);
        // The record is gone, so there is nothing a later write could replace.
        status.value = 'ready';
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
});

/** Binds the target answer time (`settings.learn.targetMs`) and loads the state; `/learn` calls it. */
export function initLearn(targetMs: () => number): Promise<void> {
  targetMsSource = targetMs;
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
export const flushLearn = store.flush;
export const resetLearning = store.reset;
