import { computed, effect, signal, untracked } from '@preact/signals';
import type { ReadonlySignal } from '@preact/signals';
import { decodePage, encodePage } from '@nekotype/shared/runtime';
import type {
  Clock,
  EventDraft,
  LearnKanaKey,
  LogEvent,
  Scheduler,
  TaskKind,
  TimeoutHandle,
} from '@nekotype/shared/types';
import type * as ModelModule from '@nekotype/model';
import type { Db, TypedChannel } from '@/shared/lib';
import {
  META_STORE,
  defaultClock,
  defaultScheduler,
  getDatabase,
  reportWriteFailure,
  typedChannel,
  uuidv7,
} from '@/shared/lib';
import {
  ANSWER_TIME_CAP_MS,
  K_WINDOW,
  answerK,
  intervalsOf,
  recallAnswerTime,
} from '../lib/answer-time';
import type { Keystroke } from '../lib/answer-time';
import { appendEvents, clearLog, isLearnMessage, isLogMeta, loadLogMeta, readLog } from './log';
import type { LearnMessage, LogMeta } from './log';

// The learn store of P7 (P7 plan, D17): the log in memory, its fold, the screen data and the
// writes. `/` and the session use it since PR 9; PR 11 retires the old store.

type Model = typeof ModelModule;
type Fold = ModelModule.Fold;
type LearnView = ModelModule.LearnView;
type ModelState = ModelModule.ModelState;

const INTERVALS_KEY = 'keyIntervals';

export type LearnStatus = 'loading' | 'ready' | 'error';

export type AnswerInput = {
  readonly task: TaskKind;
  readonly key: LearnKanaKey;
  readonly ok: boolean;
  /** Recall: the keys of the answer; the time is `recallAnswerTime` with K (A37), capped at 10,000. */
  readonly keystrokes?: readonly Keystroke[];
  /** Other tasks: showing the task → the answer, ms. */
  readonly ms?: number;
  readonly hint: boolean;
  readonly wrong: LearnKanaKey | null;
  readonly alt: LearnKanaKey | null;
};

export type LearnStoreDeps = {
  /** The database; asked for when needed, so a reset works before the store is loaded. */
  readonly db: () => Promise<Db>;
  readonly clock: Clock;
  readonly scheduler: Scheduler;
  /** The target answer time; grades fold with the current one, so a change folds again. */
  readonly targetMs: () => number;
  /** The model chunk. */
  readonly loadModel: () => Promise<Model>;
  /** A new UUID for the log device id. */
  readonly newId: () => string;
  /** The device's UTC offset in minutes east of UTC, for the `start` event. */
  readonly tz: () => number;
  /** The other tabs of the device. */
  readonly channel?: TypedChannel<LearnMessage>;
  /** A write failed (quota, a closed connection). */
  readonly onWriteFailed?: () => void;
};

export interface LearnStore {
  /** Screen data; null until ready. */
  readonly view: ReadonlySignal<LearnView | null>;
  /** The live fold state for the planner, read at each task; null until ready. */
  modelState: () => ModelState | null;
  /**
   * `loading` until the log and the model chunk are both read; `error` when either fails. After an
   * error nothing is written, so the stored log is never replaced by an empty one.
   */
  readonly status: ReadonlySignal<LearnStatus>;
  readonly ready: ReadonlySignal<boolean>;
  /** Loads once; later calls return the same promise. Never rejects. */
  init: () => Promise<void>;
  /** Loads again after an error. Never rejects. */
  retry: () => Promise<void>;
  /** A changed target answer time: grades fold again. */
  retarget: () => void;
  startSession: () => void;
  endSession: () => void;
  introduce: (key: LearnKanaKey) => void;
  recordAnswer: (input: AnswerInput) => void;
  /** "Reset progress" (guests): clears the log. */
  reset: () => Promise<void>;
  /** Reads the log again and folds it: the sync engine calls it after a pull. */
  reload: () => Promise<void>;
  /** Writes what is pending now, or waits for the write in progress. Never rejects. */
  flush: () => Promise<void>;
}

type Stored = {
  readonly meta: LogMeta;
  readonly events: readonly LogEvent[];
  readonly intervals: readonly number[] | null;
};

function isIntervals(value: unknown): value is number[] {
  return Array.isArray(value) && value.every((v) => typeof v === 'number' && Number.isFinite(v));
}

function sameIdentity(a: LogEvent, b: LogEvent): boolean {
  return a.dev === b.dev && a.n === b.n && a.at === b.at;
}

export function createLearnStore(deps: LearnStoreDeps): LearnStore {
  const view = signal<LearnView | null>(null);
  const status = signal<LearnStatus>('loading');
  const ready = computed(() => status.value === 'ready');

  let model: Model | null = null;
  let fold: Fold | null = null;
  let foldedTarget = deps.targetMs();
  /** The events of the log in order, repeats dropped: what the fold was built from. */
  let log: LogEvent[] = [];
  let meta: LogMeta | null = null;
  let intervals: number[] = [];
  let intervalsDirty = false;
  /** Events applied but not stored yet, with the identity this tab gave them. */
  let drafts: EventDraft[] = [];
  let provisional: LogEvent[] = [];
  let pending: TimeoutHandle | null = null;
  let writing: Promise<void> = Promise.resolve();
  let loading: Promise<void> | null = null;

  const foldOptions = (): { targetMs: number; stats: true } => ({
    targetMs: foldedTarget,
    stats: true,
  });

  const publish = (): void => {
    if (model === null || fold === null) return;
    const snapshot = fold.snapshot();
    if (snapshot.stats === null) return;
    view.value = model.describe(snapshot.state, snapshot.stats);
  };

  const isOrdered = (events: readonly LogEvent[], loaded: Model): boolean => {
    for (let i = 1; i < events.length; i += 1) {
      const a = events[i - 1];
      const b = events[i];
      if (a !== undefined && b !== undefined && loaded.compareEvents(a, b) >= 0) return false;
    }
    return true;
  };

  const refold = (): void => {
    if (model === null) return;
    foldedTarget = deps.targetMs();
    fold = model.foldLog(log, foldOptions());
    publish();
  };

  /** Puts the event where the order wants it and folds the whole log again. */
  const insert = (event: LogEvent, loaded: Model): void => {
    let lo = 0;
    let hi = log.length;
    while (lo < hi) {
      const mid = (lo + hi) >> 1;
      const at = log[mid];
      if (at !== undefined && loaded.compareEvents(at, event) < 0) lo = mid + 1;
      else hi = mid;
    }
    const next = log[lo];
    if (next !== undefined && loaded.compareEvents(next, event) === 0) return;
    log = [...log.slice(0, lo), event, ...log.slice(lo)];
    refold();
  };

  /** Applies one event to the fold; false when the log was folded again. */
  const place = (event: LogEvent): void => {
    if (model === null || fold === null) return;
    const result = fold.apply(event);
    if (result === 'applied') log.push(event);
    else if (result === 'out-of-order') insert(event, model);
  };

  const ensureMeta = (): LogMeta => {
    meta ??= { dev: deps.newId(), next: 1, lastAt: 0 };
    return meta;
  };

  // An action never touches IndexedDB: it gives the event its provisional identity, applies it to
  // the fold and queues the write (D17).
  const emit = (fields: EventDraft): void => {
    if (status.value !== 'ready' || fold === null) return;
    const current = ensureMeta();
    const at = Math.max(fields.at, current.lastAt);
    const event: LogEvent = { ...fields, at, dev: current.dev, n: current.next };
    meta = { dev: current.dev, next: current.next + 1, lastAt: at };
    drafts.push(fields);
    provisional.push(event);
    place(event);
    publish();
    schedule();
  };

  const readStored = async (): Promise<Stored> => {
    const db = await deps.db();
    const [stored, events, saved] = await Promise.all([
      loadLogMeta(db, deps.newId),
      readLog(db),
      db.get(META_STORE, INTERVALS_KEY),
    ]);
    return { meta: stored, events, intervals: isIntervals(saved) ? saved : null };
  };

  const adopt = (loaded: Model, stored: Stored): void => {
    model = loaded;
    log = isOrdered(stored.events, loaded)
      ? [...stored.events]
      : [...stored.events].sort(loaded.compareEvents);
    meta = stored.meta;
    if (!intervalsDirty && stored.intervals !== null) intervals = stored.intervals.slice(-K_WINDOW);
    refold();
  };

  type Outcome = 'ok' | 'stale' | 'failed';

  /** Stores the pending drafts; 'stale' when what was stored differs from what was applied. */
  const writeBatch = async (): Promise<Outcome> => {
    if (drafts.length === 0 && !intervalsDirty) return 'ok';
    const taken = drafts;
    const applied = provisional;
    const keep = intervals;
    const keepDirty = intervalsDirty;
    drafts = [];
    provisional = [];
    intervalsDirty = false;
    try {
      const db = await deps.db();
      const stored = await appendEvents(db, taken, deps.newId);
      if (keepDirty) await db.put(META_STORE, INTERVALS_KEY, keep);
      if (stored.length > 0) deps.channel?.post({ kind: 'append', page: encodePage(stored) });
      return stored.length === applied.length &&
        stored.every((e, i) => {
          const was = applied[i];
          return was !== undefined && sameIdentity(e, was);
        })
        ? 'ok'
        : 'stale';
    } catch {
      // The write failed (quota, a closed connection): the events wait for the next write.
      drafts = [...taken, ...drafts];
      provisional = [...applied, ...provisional];
      if (keepDirty) intervalsDirty = true;
      deps.onWriteFailed?.();
      return 'failed';
    }
  };

  /** Writes everything pending, then reads the log and folds it again. In the chain of writes. */
  const rebuild = async (): Promise<void> => {
    if (model === null) return;
    while (drafts.length > 0 || intervalsDirty) {
      if ((await writeBatch()) === 'failed') return;
    }
    adopt(model, await readStored());
  };

  const write = (): Promise<void> => {
    pending = null;
    // After a failed read the log in memory is not the stored one: writing would mix them.
    if (status.value === 'error') {
      deps.onWriteFailed?.();
      return writing;
    }
    writing = writing.then(async () => {
      if ((await writeBatch()) === 'stale') await rebuild();
    });
    return writing;
  };

  const schedule = (): void => {
    if (pending !== null) return;
    pending = deps.scheduler.setTimeout(() => {
      void write();
    }, 0);
  };

  const reload = (): Promise<void> => {
    writing = writing
      .then(async () => {
        if (status.value !== 'ready') return;
        await rebuild();
      })
      .catch(() => {});
    return writing;
  };

  const emptyLog = (): void => {
    drafts = [];
    provisional = [];
    intervalsDirty = false;
    log = [];
    meta = null;
    if (model !== null) {
      fold = model.createFold(foldOptions());
      publish();
    }
  };

  deps.channel?.listen((message) => {
    if (message.kind === 'pull') {
      void reload();
    } else if (message.kind === 'reset') {
      if (pending !== null) deps.scheduler.clearTimeout(pending);
      pending = null;
      emptyLog();
    } else if (status.value === 'ready') {
      // Another tab of this device wrote: its `n`s are ours too, so the next one moves on.
      const events = decodePage(message.page) ?? [];
      for (const event of events) {
        place(event);
        if (meta !== null && event.dev === meta.dev) {
          meta = {
            dev: meta.dev,
            next: Math.max(meta.next, event.n + 1),
            lastAt: Math.max(meta.lastAt, event.at),
          };
        }
      }
      publish();
    }
  });

  const init = (): Promise<void> => {
    loading ??= (async () => {
      status.value = 'loading';
      try {
        // The log and the model chunk load together.
        const [loaded, stored] = await Promise.all([deps.loadModel(), readStored()]);
        adopt(loaded, stored);
        status.value = 'ready';
      } catch {
        // The read failed: the stored log may be fine, so it is left alone until a retry succeeds.
        status.value = 'error';
      }
    })();
    return loading;
  };

  return {
    view,
    modelState: () => fold?.state ?? null,
    status,
    ready,
    init,

    retry() {
      if (status.value !== 'error') return loading ?? init();
      loading = null;
      return init();
    },

    retarget() {
      if (status.value !== 'ready' || deps.targetMs() === foldedTarget) return;
      refold();
    },

    startSession() {
      emit({ t: 'start', at: deps.clock.now(), tz: deps.tz() });
    },

    endSession() {
      emit({ t: 'end', at: deps.clock.now() });
    },

    introduce(key) {
      emit({ t: 'intro', at: deps.clock.now(), k: key });
    },

    recordAnswer(input) {
      let ms: number;
      if (input.task === 'recall') {
        const keystrokes = input.keystrokes ?? [];
        ms = Math.round(recallAnswerTime(keystrokes, answerK(intervals)));
        intervals = [...intervals, ...intervalsOf(keystrokes)].slice(-K_WINDOW);
        intervalsDirty = true;
      } else {
        ms = Math.min(ANSWER_TIME_CAP_MS, Math.max(0, Math.round(input.ms ?? 0)));
      }
      emit({
        t: 'answer',
        at: deps.clock.now(),
        task: input.task,
        k: input.key,
        ok: input.ok,
        ms,
        hint: input.hint,
        wrong: input.wrong,
        alt: input.alt,
      });
    },

    reload,

    async flush() {
      if (pending === null) return writing;
      deps.scheduler.clearTimeout(pending);
      return write();
    },

    async reset() {
      if (pending !== null) deps.scheduler.clearTimeout(pending);
      pending = null;
      emptyLog();
      await writing;
      try {
        const db = await deps.db();
        await clearLog(db);
        // The new identity is stored at once, so a tab that reads the log finds the same one.
        const stored = await loadLogMeta(db, deps.newId);
        if (isLogMeta(stored)) meta = stored;
        // The stored log is gone, so there is nothing a later write could replace.
        status.value = 'ready';
        deps.channel?.post({ kind: 'reset' });
      } catch {
        // The log could not be cleared; what is stored stays until the next reset.
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
  loadModel: () => import('@nekotype/model'),
  newId: () => uuidv7(defaultClock.now()),
  tz: () => -new Date().getTimezoneOffset(),
  channel: typedChannel('nekotype:learn', isLearnMessage),
  onWriteFailed: reportWriteFailure,
});

let watching = false;

/** Binds `settings.learn.targetMs` and loads the log and the model; `/` and `/stats` call it. */
export function initLearn(targetMs: () => number): Promise<void> {
  targetMsSource = targetMs;
  if (!watching) {
    watching = true;
    // A changed target folds the log again; `untracked` keeps the effect off the view.
    effect(() => {
      targetMs();
      untracked(() => {
        store.retarget();
      });
    });
  }
  return store.init();
}

export const learnView: ReadonlySignal<LearnView | null> = store.view;
export const modelState = store.modelState;
export const learnStatus: ReadonlySignal<LearnStatus> = store.status;
export const learnReady: ReadonlySignal<boolean> = store.ready;
export const retryLearn = store.retry;
export const startSession = store.startSession;
export const endSession = store.endSession;
export const introduce = store.introduce;
export const recordAnswer = store.recordAnswer;
export const resetLearning = store.reset;
export const reloadLearning = store.reload;
export const flushLearning = store.flush;
