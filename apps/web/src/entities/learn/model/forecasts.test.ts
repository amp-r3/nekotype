import { describe, expect, it } from 'vitest';
import { createMemoryDb } from '@/shared/lib';
import type { Db } from '@/shared/lib';
import {
  HISTORY_OPEN_KEPT,
  HISTORY_SETTLED_KEPT,
  createForecastHistory,
  recordKey,
} from './forecasts';
import type { ForecastRecord } from './insights-types';

const ROW = 'hiragana:vowels';
const record = (over: Partial<ForecastRecord> = {}): ForecastRecord => ({
  row: ROW,
  day: 20_000,
  at: 1000,
  raw: 2,
  started: 10,
  actual: null,
  ...over,
});
const put = (db: Db, r: ForecastRecord): Promise<void> =>
  db.put('forecasts', recordKey(r.row, r.day), r);
const stored = async (db: Db): Promise<readonly unknown[]> => db.getAll('forecasts');

function setup() {
  const db = createMemoryDb();
  return { db, history: createForecastHistory(() => Promise.resolve(db)) };
}

describe('forecast history (P8 D10)', () => {
  it('reads the store once, skips an invalid record and keeps the settled in order of at', async () => {
    const { db, history } = setup();
    await put(db, record({ day: 1, at: 30, actual: 2 }));
    await put(db, record({ day: 2, at: 10, actual: 3 }));
    await db.put('forecasts', 'broken', { row: 5 });
    await history.load();
    expect(history.settled().map((r) => r.at)).toEqual([10, 30]);
    // Held in memory: a record that appears later is not read again.
    await put(db, record({ day: 3, at: 5, actual: 1 }));
    await history.load();
    expect(history.settled()).toHaveLength(2);
  });

  it('keeps the first forecast of a row on a day and no more', async () => {
    const { db, history } = setup();
    await history.add(record({ raw: 3 }));
    await history.add(record({ raw: 9, at: 2000 }));
    await history.add(record({ day: 20_001, raw: 4 }));
    const all = await stored(db);
    expect(all).toHaveLength(2);
    expect(all).toContainEqual(record({ raw: 3 }));
  });

  it('writes nothing when another tab already holds the key', async () => {
    const { db, history } = setup();
    await history.load();
    // Another tab wrote it after this tab read the store.
    await put(db, record({ raw: 7 }));
    await history.add(record({ raw: 3 }));
    expect(await stored(db)).toEqual([record({ raw: 7 })]);
  });

  it('settles a record once its row has no locked kana: actual counts from `started`', async () => {
    const { db, history } = setup();
    await put(db, record({ started: 10 }));
    // A locked kana: the record stays open.
    await history.settle(() => null);
    expect(await stored(db)).toEqual([record({ started: 10 })]);
    // Shown with 10 sessions behind it, the last kana introduced in session 11: 1 session.
    await history.settle(() => 11);
    expect(await stored(db)).toEqual([record({ started: 10, actual: 1 })]);
    // Settled records do not settle again.
    await history.settle(() => 15);
    expect(await stored(db)).toEqual([record({ started: 10, actual: 1 })]);
  });

  it('deletes a record that settles below 1', async () => {
    const { db, history } = setup();
    await put(db, record({ started: 10 }));
    await history.settle(() => 10);
    expect(await stored(db)).toEqual([]);
    expect(history.settled()).toEqual([]);
  });

  it('keeps the newest 10 settled and the newest 60 open records', async () => {
    const { db, history } = setup();
    for (let i = 0; i < 14; i += 1) await put(db, record({ day: i, at: 100 + i, actual: 2 }));
    for (let i = 0; i < 65; i += 1) {
      await put(db, record({ row: 'katakana:vowels', day: i, at: 1000 + i, actual: null }));
    }
    await history.settle(() => null);
    const all = (await stored(db)).filter((v): v is ForecastRecord => typeof v === 'object');
    const settled = all.filter((r) => r.actual !== null);
    const open = all.filter((r) => r.actual === null);
    expect(settled).toHaveLength(HISTORY_SETTLED_KEPT);
    expect(Math.min(...settled.map((r) => r.at))).toBe(104);
    expect(open).toHaveLength(HISTORY_OPEN_KEPT);
    expect(Math.min(...open.map((r) => r.at))).toBe(1005);
    expect(history.settled()).toHaveLength(HISTORY_SETTLED_KEPT);
  });

  it('trims when a record is added, too', async () => {
    const { db, history } = setup();
    for (let i = 0; i < HISTORY_OPEN_KEPT; i += 1) await put(db, record({ day: i, at: 10 + i }));
    await history.add(record({ day: 999, at: 5000 }));
    const all = await stored(db);
    expect(all).toHaveLength(HISTORY_OPEN_KEPT);
    expect(all).toContainEqual(record({ day: 999, at: 5000 }));
    expect(all).not.toContainEqual(record({ day: 0, at: 10 }));
  });

  it('forgets what it read on drop, and a read that was running does not fill the cache', async () => {
    const { db, history } = setup();
    await put(db, record({ actual: 2 }));
    await history.load();
    expect(history.settled()).toHaveLength(1);
    await db.write([{ op: 'clear', store: 'forecasts' }]);
    history.drop();
    expect(history.settled()).toEqual([]);
    await history.load();
    expect(history.settled()).toEqual([]);

    const racing = setup();
    await put(racing.db, record({ actual: 2 }));
    const reading = racing.history.load();
    racing.history.drop();
    await reading;
    expect(racing.history.settled()).toEqual([]);
  });

  it('never rejects when the database fails', async () => {
    const history = createForecastHistory(() => Promise.reject(new Error('closed')));
    await expect(history.load()).resolves.toBeUndefined();
    await expect(history.add(record())).resolves.toBeUndefined();
    await expect(history.settle(() => 20)).resolves.toBeUndefined();
    expect(history.settled()).toEqual([]);
  });
});
