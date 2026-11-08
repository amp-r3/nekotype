import { signal } from '@preact/signals';
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
import { RECENT_ANSWERS, isCounters, isLearnState, isObject } from '@nekotype/shared/runtime';
import type { Db } from '@/shared/lib';
import { defaultClock, defaultScheduler, getDatabase } from '@/shared/lib';
import { K_WINDOW, intervalsOf, recallAnswerTime, typingK } from '../lib/answer-time';
import type { Keystroke } from '../lib/answer-time';
import { evaluateUnlocking, initialCounters, initialLearnState } from '../lib/state';

const DELTA_STORE = 'delta';
const DELTA_KEY = 'current';
const META_STORE = 'meta';
const INTERVALS_KEY = 'typingIntervals';

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
};

export type RecognitionInput = {
  readonly key: LearnKanaKey;
  /** The kana chosen; a wrong choice is a mixup of `key`. */
  readonly chosen: LearnKanaKey;
};

export interface LearnStore {
  readonly state: ReadonlySignal<LearnState>;
  readonly counters: ReadonlySignal<Counters>;
  /** True once the state has been read from the database (or the initial state was taken). */
  readonly ready: ReadonlySignal<boolean>;
  /** Reads the state once; later calls return the same promise. Never rejects. */
  init: () => Promise<void>;
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
  const ready = signal(false);

  let intervals: number[] = [];
  let lastAt = 0;
  let pending: TimeoutHandle | null = null;
  let writing: Promise<void> = Promise.resolve();
  let loading: Promise<void> | null = null;

  const unlock = (next: LearnState): LearnState => evaluateUnlocking(next, deps.targetMs());

  const write = (): Promise<void> => {
    pending = null;
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
      try {
        const db = await deps.db();
        const doc = await db.get(DELTA_STORE, DELTA_KEY);
        if (isObject(doc) && isLearnState(doc['learn']) && isCounters(doc['counters'])) {
          state.value = unlock(doc['learn']);
          counters.value = doc['counters'];
        }
        const saved = await db.get(META_STORE, INTERVALS_KEY);
        if (isIntervals(saved)) intervals = saved.slice(-K_WINDOW);
      } catch {
        // Unreadable: the initial state stands.
      }
      ready.value = true;
    })();
    return loading;
  };

  return {
    state,
    counters,
    ready,
    init,

    introduce(key) {
      const current = state.value;
      if (current.entries[key] !== undefined) return;
      const entry = { box: 0, dueAt: 0, updatedAt: deps.clock.now() } as const;
      commit({ ...current, entries: { ...current.entries, [key]: entry } });
    },

    recordRecall({ key, keystrokes, ok }) {
      const ms = recallAnswerTime(keystrokes, typingK(intervals));
      // `at` identifies the answer in a merge, so two answers never share one.
      lastAt = Math.max(deps.clock.now(), lastAt + 1);
      const answer: RecallAnswer = { at: lastAt, ms, ok };
      intervals = [...intervals, ...intervalsOf(keystrokes)].slice(-K_WINDOW);
      const current = state.value;
      const recent = [...(current.recent[key] ?? []), answer].slice(-RECENT_ANSWERS);
      commit({ ...current, recent: { ...current.recent, [key]: recent } });
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
      commit({ ...current, stats: { ...current.stats, [key]: stat } });
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
export const learnReady: ReadonlySignal<boolean> = store.ready;
export const introduce = store.introduce;
export const recordRecall = store.recordRecall;
export const recordRecognition = store.recordRecognition;
export const countSession = store.countSession;
export const flushLearn = store.flush;
export const resetLearning = store.reset;
