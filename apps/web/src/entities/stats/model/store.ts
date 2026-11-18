import { signal } from '@preact/signals';
import type { ReadonlySignal } from '@preact/signals';
import type { Counters, KanaStat, TestResult, TypingRecords } from '@nekotype/shared/types';
import {
  addCounters,
  applyResultToRecords,
  isCounters,
  isKanaStat,
  isObject,
  isTestResult,
  isTypingRecords,
  mergeKanaStats,
  mergeTypingRecords,
} from '@nekotype/shared/runtime';
import type { ChangeChannel, Db, Write } from '@/shared/lib';
import {
  DELTA_STORE,
  changeChannel,
  getDatabase,
  readWithSyncBase,
  reportWriteFailure,
} from '@/shared/lib';
import type { KanaStatMap } from './types';

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
  /**
   * Every saved result, oldest first, read in one transaction. Rejects when the database cannot
   * be read.
   */
  allResults: () => Promise<TestResult[]>;
  /** "Reset progress": clears results, records and the typing delta. */
  reset: () => Promise<void>;
}

function initialCounters(): Counters {
  return { started: { typing: 0, learn: 0 }, finished: { typing: 0, learn: 0 } };
}

function isKanaStatMap(value: unknown): value is KanaStatMap {
  return isObject(value) && Object.values(value).every(isKanaStat);
}

/** `delta/typing`: the changes since the last batch (D15); for a guest, the whole state. */
type TypingChanges = { readonly kanaStats: KanaStatMap; readonly counters: Counters };

const noChanges = (): TypingChanges => ({ kanaStats: {}, counters: initialCounters() });

function readChanges(value: unknown): TypingChanges | null {
  if (isObject(value) && isKanaStatMap(value['kanaStats']) && isCounters(value['counters'])) {
    return { kanaStats: value['kanaStats'], counters: value['counters'] };
  }
  return null;
}

/** The records a value holds under `typingRecords` (the snapshot's), or none. */
function readRecords(value: unknown): TypingRecords {
  const records = isObject(value) ? value['typingRecords'] : undefined;
  return isTypingRecords(records) ? records : {};
}

export function createTypingStore(deps: TypingStoreDeps): TypingStore {
  const kanaStats = signal<KanaStatMap>({});
  const counters = signal<Counters>(initialCounters());
  const records = signal<TypingRecords>({});
  const status = signal<TypingStatus>('loading');

  let writing: Promise<void> = Promise.resolve();
  let loading: Promise<void> | null = null;

  // Rebuilds the view from the snapshot, the outbox and the stored delta (D18), read in one
  // transaction; the records are the snapshot's merged with the device's own. Throws when the
  // database cannot be read. Every write of this store is complete when it returns, so nothing
  // unwritten is left to put on top.
  const load = async (): Promise<void> => {
    const db = await deps.db();
    const { base, values } = await readWithSyncBase(db, [
      { store: DELTA_STORE, key: DELTA_KEY },
      { store: RECORDS_STORE, key: RECORDS_KEY },
    ]);
    // The snapshot and the outbox's delta hold `kanaStats` and `counters` as the delta record does.
    const own = readChanges(values[0]) ?? noChanges();
    const snapshot = readChanges(base.snapshot);
    const sent = readChanges(base.outbox);
    let stats: Readonly<Record<string, KanaStat>> = snapshot?.kanaStats ?? {};
    let sum = snapshot?.counters ?? initialCounters();
    if (sent !== null) {
      stats = mergeKanaStats(stats, sent.kanaStats);
      sum = addCounters(sum, sent.counters);
    }
    kanaStats.value = mergeKanaStats(stats, own.kanaStats);
    counters.value = addCounters(sum, own.counters);
    const stored = values[1];
    records.value = mergeTypingRecords(
      readRecords(base.snapshot),
      isTypingRecords(stored) ? stored : {},
    );
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

  // A change to the stored delta and what goes with it, in one transaction that reads the stored
  // records first, so another tab's tests count too. Queued in order.
  const enqueue = (
    change: (stored: TypingChanges, records: unknown) => { delta: TypingChanges; writes: Write[] },
  ): Promise<void> => {
    // After a failed read the state in memory is not the stored one: writing it would replace the
    // stored record with the initial state.
    if (status.value === 'error') {
      // The test is shown but not kept: say so, as for any write that fails.
      deps.onWriteFailed?.();
      return writing;
    }
    writing = writing
      .then(async () => {
        const db = await deps.db();
        await db.update(
          [
            { store: DELTA_STORE, key: DELTA_KEY },
            { store: RECORDS_STORE, key: RECORDS_KEY },
          ],
          ([storedDelta, storedRecords]) => {
            const { delta, writes } = change(
              readChanges(storedDelta) ?? noChanges(),
              storedRecords,
            );
            return [{ op: 'put', store: DELTA_STORE, key: DELTA_KEY, value: delta }, ...writes];
          },
          [RESULTS_STORE],
        );
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

      // The view, incrementally.
      kanaStats.value = mergeKanaStats(kanaStats.value, kanaDelta);
      const increment: Counters = {
        started: { typing: startedIncrement, learn: 0 },
        finished: { typing: 1, learn: 0 },
      };
      counters.value = addCounters(counters.value, increment);
      records.value = applied.records;

      await enqueue((stored, storedRecords) => ({
        delta: {
          kanaStats: mergeKanaStats(stored.kanaStats, kanaDelta),
          counters: addCounters(stored.counters, increment),
        },
        writes: [
          { op: 'put', store: RESULTS_STORE, key: saved.id, value: { ...saved, synced: 0 } },
          {
            op: 'put',
            store: RECORDS_STORE,
            key: RECORDS_KEY,
            value: applyResultToRecords(isTypingRecords(storedRecords) ? storedRecords : {}, result)
              .records,
          },
        ],
      }));
      return {
        result: saved,
        average: applied.average,
        previousBest: applied.previousBest,
        isBest: applied.isBest,
      };
    },

    async recordDiscarded() {
      await init();
      const increment: Counters = {
        started: { typing: 1, learn: 0 },
        finished: { typing: 0, learn: 0 },
      };
      counters.value = addCounters(counters.value, increment);
      await enqueue((stored) => ({
        delta: { ...stored, counters: addCounters(stored.counters, increment) },
        writes: [],
      }));
    },

    flush() {
      return writing;
    },

    async allResults() {
      // After the writes in progress, so a test that has just ended is in the list.
      await init();
      await writing;
      const db = await deps.db();
      const rows = await db.getAll(RESULTS_STORE, 'endedAt');
      return rows.filter(isTestResult);
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
        deps.channel?.post('reset');
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
export const retryTyping = store.retry;
export const readAllResults = store.allResults;
