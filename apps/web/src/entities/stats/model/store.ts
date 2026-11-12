import { signal } from '@preact/signals';
import type { ReadonlySignal } from '@preact/signals';
import type { Counters, KanaStat, TestResult, TypingRecords } from '@nekotype/shared/types';
import {
  addKanaStats,
  applyResultToRecords,
  decayKanaStat,
  isCounters,
  isKanaStat,
  isObject,
  isTypingRecords,
} from '@nekotype/shared/runtime';
import type { ChangeChannel, Db } from '@/shared/lib';
import { changeChannel, getDatabase, reportWriteFailure } from '@/shared/lib';
import type { KanaStatMap } from './types';

const DELTA_STORE = 'delta';
const DELTA_KEY = 'typing';
const RESULTS_STORE = 'results';
const RECORDS_STORE = 'records';
const RECORDS_KEY = 'current';

export type TypingStatus = 'loading' | 'ready' | 'error';

export type TypingStoreDeps = {
  /** The database; asked for when needed, so a reset works before the store is loaded. */
  readonly db: () => Promise<Db>;
  /** Other tabs: posted after a successful write; their messages make the store read again. */
  readonly channel?: ChangeChannel;
  /** A write failed (quota, a closed connection). */
  readonly onWriteFailed?: () => void;
};

export type SaveTestInput = {
  /** `celebratedPersonalBest` is set by the store, from the records it holds. */
  readonly result: TestResult;
  /** Attempts and errored attempts of the test's committed tokens, per kana. */
  readonly kanaDelta: KanaStatMap;
  /** Added to the `started` counter of typing: 1 for the test being saved. */
  readonly startedIncrement: number;
};

export type SavedTest = {
  readonly result: TestResult;
  /** The average KPM and the best before this result (null when there was none). */
  readonly average: number | null;
  readonly previousBest: number | null;
  readonly isBest: boolean;
};

export interface TypingStore {
  readonly kanaStats: ReadonlySignal<KanaStatMap>;
  readonly counters: ReadonlySignal<Counters>;
  readonly records: ReadonlySignal<TypingRecords>;
  /** `loading` until the stored records have been read; `error` when reading them failed. */
  readonly status: ReadonlySignal<TypingStatus>;
  /** Reads the stored state once; later calls return the same promise. Never rejects. */
  init: () => Promise<void>;
  /** Reads the state again after an error. Never rejects. */
  retry: () => Promise<void>;
  /**
   * Saves a finished test: its result, its kana statistics, the counters and the records, in one
   * transaction (D23). Resolves when the write is done; never rejects.
   */
  saveTest: (input: SaveTestInput) => Promise<SavedTest>;
  /** A test that started and was dropped: only the `started` counter changes. */
  recordDiscarded: () => Promise<void>;
  /** Waits for the writes in progress. Never rejects. */
  flush: () => Promise<void>;
  /** "Reset progress": clears results, records and the typing delta. */
  reset: () => Promise<void>;
}

function initialCounters(): Counters {
  return { started: { typing: 0, learn: 0 }, finished: { typing: 0, learn: 0 } };
}

function isKanaStatMap(value: unknown): value is KanaStatMap {
  return isObject(value) && Object.values(value).every(isKanaStat);
}

export function createTypingStore(deps: TypingStoreDeps): TypingStore {
  const kanaStats = signal<KanaStatMap>({});
  const counters = signal<Counters>(initialCounters());
  const records = signal<TypingRecords>({});
  const status = signal<TypingStatus>('loading');

  let writing: Promise<void> = Promise.resolve();
  let loading: Promise<void> | null = null;

  // Reads both records into the signals. Throws when the database cannot be read.
  const load = async (): Promise<void> => {
    const db = await deps.db();
    const doc = await db.get(DELTA_STORE, DELTA_KEY);
    // A record that fails validation is not taken: the initial state stands (ADR 061).
    if (isObject(doc) && isKanaStatMap(doc['kanaStats']) && isCounters(doc['counters'])) {
      kanaStats.value = doc['kanaStats'];
      counters.value = doc['counters'];
    }
    const stored = await db.get(RECORDS_STORE, RECORDS_KEY);
    if (isTypingRecords(stored)) records.value = stored;
  };

  // Another tab wrote: take its state, in the chain of writes so that it is not read during our own.
  const reload = (): Promise<void> => {
    writing = writing
      .then(async () => {
        if (status.value === 'ready') await load();
      })
      .catch(() => {});
    return writing;
  };
  deps.channel?.listen(() => {
    void reload();
  });

  const init = (): Promise<void> => {
    loading ??= (async () => {
      status.value = 'loading';
      try {
        await load();
        status.value = 'ready';
      } catch {
        // The read failed: the record may be fine, so it is left alone until a retry succeeds.
        status.value = 'error';
      }
    })();
    return loading;
  };

  // The delta record as it stands now, and the writes that go with it, queued in order.
  const enqueue = (extra: (db: Db) => Parameters<Db['write']>[0]): Promise<void> => {
    // After a failed read the state in memory is not the stored one: writing it would replace the
    // stored record with the initial state.
    if (status.value === 'error') return writing;
    const delta = { kanaStats: kanaStats.value, counters: counters.value };
    writing = writing
      .then(async () => {
        const db = await deps.db();
        await db.write([
          { op: 'put', store: DELTA_STORE, key: DELTA_KEY, value: delta },
          ...extra(db),
        ]);
        deps.channel?.post();
      })
      .catch(() => {
        deps.onWriteFailed?.();
      });
    return writing;
  };

  return {
    kanaStats,
    counters,
    records,
    status,
    init,

    retry() {
      if (status.value !== 'error') return loading ?? init();
      loading = null;
      return init();
    },

    async saveTest({ result, kanaDelta, startedIncrement }) {
      await init();
      const applied = applyResultToRecords(records.value, result);
      const saved: TestResult = { ...result, celebratedPersonalBest: applied.isBest };

      const stats: Record<string, KanaStat> = { ...kanaStats.value };
      for (const [key, delta] of Object.entries(kanaDelta)) {
        stats[key] = decayKanaStat(addKanaStats(stats[key], delta));
      }
      const current = counters.value;
      kanaStats.value = stats;
      counters.value = {
        started: { ...current.started, typing: current.started.typing + startedIncrement },
        finished: { ...current.finished, typing: current.finished.typing + 1 },
      };
      records.value = applied.records;

      const recordsNow = applied.records;
      await enqueue(() => [
        { op: 'put', store: RESULTS_STORE, key: saved.id, value: { ...saved, synced: 0 } },
        { op: 'put', store: RECORDS_STORE, key: RECORDS_KEY, value: recordsNow },
      ]);
      return {
        result: saved,
        average: applied.average,
        previousBest: applied.previousBest,
        isBest: applied.isBest,
      };
    },

    async recordDiscarded() {
      await init();
      const current = counters.value;
      counters.value = {
        ...current,
        started: { ...current.started, typing: current.started.typing + 1 },
      };
      await enqueue(() => []);
    },

    flush() {
      return writing;
    },

    async reset() {
      kanaStats.value = {};
      counters.value = initialCounters();
      records.value = {};
      await writing;
      try {
        const db = await deps.db();
        await db.write([
          { op: 'clear', store: RESULTS_STORE },
          { op: 'delete', store: DELTA_STORE, key: DELTA_KEY },
          { op: 'delete', store: RECORDS_STORE, key: RECORDS_KEY },
        ]);
        deps.channel?.post();
        // The records are gone, so there is nothing a later write could replace.
        status.value = 'ready';
      } catch {
        // They could not be deleted; the next write replaces them.
      }
    },
  };
}

const store = createTypingStore({
  db: getDatabase,
  channel: changeChannel('nekotype:typing'),
  onWriteFailed: reportWriteFailure,
});

export const typingKanaStats: ReadonlySignal<KanaStatMap> = store.kanaStats;
export const typingCounters: ReadonlySignal<Counters> = store.counters;
export const typingRecords: ReadonlySignal<TypingRecords> = store.records;
export const typingStatus: ReadonlySignal<TypingStatus> = store.status;
export const initTyping = store.init;
export const saveTest = store.saveTest;
export const recordDiscardedTest = store.recordDiscarded;
export const resetTyping = store.reset;
