import { isObject } from '@nekotype/shared/runtime';
import type { RowId } from '@nekotype/model';
import type { Db, Write } from '@/shared/lib';
import { FORECASTS_STORE } from '@/shared/lib';
import type { ForecastRecord } from './insights-types';

// The forecast history (P8 plan, D10): the store `forecasts` of IndexedDB, read once and held in
// memory, written through. It is never synced and never touched by a key handler.

/** The settled records kept: the forecast reads the last `FORECAST_HISTORY` of them. */
export const HISTORY_SETTLED_KEPT = 10;
/** The open records kept: about two months of daily forecasts. */
export const HISTORY_OPEN_KEPT = 60;

export function recordKey(row: RowId, day: number): string {
  return `${row}@${day}`;
}

export function isForecastRecord(value: unknown): value is ForecastRecord {
  if (!isObject(value)) return false;
  const { row, day, at, raw, started, actual } = value;
  return (
    typeof row === 'string' &&
    row.length > 0 &&
    Number.isSafeInteger(day) &&
    typeof at === 'number' &&
    Number.isFinite(at) &&
    Number.isSafeInteger(raw) &&
    Number.isSafeInteger(started) &&
    (actual === null || Number.isSafeInteger(actual))
  );
}

export type ForecastHistory = {
  /** Reads the store once; later calls wait for the same read. Never rejects. */
  load: () => Promise<void>;
  /** The settled records, oldest first, at most `HISTORY_SETTLED_KEPT`. */
  settled: () => readonly ForecastRecord[];
  /**
   * Settles the open records whose row has no locked kana: `lastIntroduced` gives the `introducedIn`
   * of the row's last kana, null while one is locked. Never rejects.
   */
  settle: (lastIntroduced: (row: RowId) => number | null) => Promise<void>;
  /** Keeps the record unless its key (row and day) is already there. Never rejects. */
  add: (record: ForecastRecord) => Promise<void>;
  /** Forgets what was read: the store was cleared underneath (reset, sign-out). */
  drop: () => void;
};

const byAt = (a: ForecastRecord, b: ForecastRecord): number => a.at - b.at;

export function createForecastHistory(db: () => Promise<Db>): ForecastHistory {
  let cache: Map<string, ForecastRecord> | null = null;
  let loading: Promise<void> | null = null;
  /** A `drop` during a read must not let that read fill the cache. */
  let generation = 0;

  const apply = (writes: readonly Write[]): void => {
    if (cache === null) return;
    for (const w of writes) {
      if (w.op === 'put' && isForecastRecord(w.value)) cache.set(w.key, w.value);
      else if (w.op === 'delete') cache.delete(w.key);
    }
  };

  const write = async (writes: readonly Write[]): Promise<void> => {
    if (writes.length === 0) return;
    try {
      await (await db()).write(writes);
      apply(writes);
    } catch {
      // The history is a correction only: a failed write loses it, nothing else.
    }
  };

  /** Deletes the records beyond what is kept: the oldest settled and the oldest open. */
  const trimWrites = (): Write[] => {
    if (cache === null) return [];
    const all = [...cache.values()].sort(byAt);
    const settled = all.filter((r) => r.actual !== null);
    const open = all.filter((r) => r.actual === null);
    return [
      ...settled.slice(0, Math.max(0, settled.length - HISTORY_SETTLED_KEPT)),
      ...open.slice(0, Math.max(0, open.length - HISTORY_OPEN_KEPT)),
    ].map((r): Write => ({ op: 'delete', store: FORECASTS_STORE, key: recordKey(r.row, r.day) }));
  };

  const load = (): Promise<void> => {
    loading ??= (async () => {
      const mine = generation;
      const records = new Map<string, ForecastRecord>();
      try {
        for (const value of await (await db()).getAll(FORECASTS_STORE)) {
          if (isForecastRecord(value)) records.set(recordKey(value.row, value.day), value);
        }
      } catch {
        // Unreadable: the forecast goes without a correction.
      }
      if (mine === generation) cache = records;
    })();
    return loading;
  };

  return {
    load,
    settled: () =>
      [...(cache?.values() ?? [])]
        .filter((r) => r.actual !== null)
        .sort(byAt)
        .slice(-HISTORY_SETTLED_KEPT),

    async settle(lastIntroduced) {
      await load();
      if (cache === null) return;
      const writes: Write[] = [];
      for (const [key, record] of cache) {
        if (record.actual !== null) continue;
        const last = lastIntroduced(record.row);
        if (last === null) continue;
        const actual = last - record.started;
        // Below 1 the row was finished in a session older than the forecast (a late pull).
        writes.push(
          actual < 1
            ? { op: 'delete', store: FORECASTS_STORE, key }
            : { op: 'put', store: FORECASTS_STORE, key, value: { ...record, actual } },
        );
      }
      await write(writes);
      await write(trimWrites());
    },

    async add(record) {
      await load();
      if (cache === null) return;
      const key = recordKey(record.row, record.day);
      if (cache.has(key)) return;
      try {
        // Two tabs: the transaction writes only when no record has the key. What is there stays
        // the first forecast of the day, and this tab holds that one.
        let kept = record;
        await (
          await db()
        ).update([{ store: FORECASTS_STORE, key }], ([stored]) => {
          if (stored === undefined)
            return [{ op: 'put', store: FORECASTS_STORE, key, value: record }];
          if (isForecastRecord(stored)) kept = stored;
          return [];
        });
        cache.set(key, kept);
      } catch {
        return;
      }
      await write(trimWrites());
    },

    drop() {
      generation += 1;
      cache = null;
      loading = null;
    },
  };
}
