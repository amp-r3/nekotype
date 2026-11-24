import { describe, it, expect } from 'vitest';
import { IDBFactory } from 'fake-indexeddb';
import { LOG_PAGE_EVENTS, encodePage } from '@nekotype/shared/runtime';
import type { EventDraft, LogEvent } from '@nekotype/shared/types';
import { createMemoryDb, openDatabase } from '@/shared/lib';
import type { Db } from '@/shared/lib';
import {
  OPEN_PAGE_KEY,
  appendEvents,
  clearLog,
  isLearnMessage,
  isLogMeta,
  loadLogMeta,
  ownPageKey,
  readLog,
  readUnsent,
  rowPageKey,
} from './log';

const DEV = '018f0000-0000-7000-8000-000000000001';
const OTHER = '018f0000-0000-7000-8000-000000000002';

let ids = 0;
const newId = (): string => `018f0000-0000-7000-8000-${String(100 + ids++).padStart(12, '0')}`;

const intro = (at: number): EventDraft => ({ t: 'intro', at, k: 'hiragana:あ' });
const drafts = (count: number, at = 1000): EventDraft[] =>
  Array.from({ length: count }, (_, i) => intro(at + i));

describe('appendEvents', () => {
  it('rounds a fractional clock time: an event time is an integer', async () => {
    const db = createMemoryDb();
    const stored = await appendEvents(db, [intro(1000.4), intro(1001.6)], newId);
    expect(stored.map((e) => e.at)).toEqual([1000, 1002]);
    expect((await readLog(db)).map((e) => e.at)).toEqual([1000, 1002]);
  });

  it('creates the identity and gives n and at in the transaction', async () => {
    const db = createMemoryDb();
    const stored = await appendEvents(db, [intro(500), intro(400), intro(900)], newId);
    expect(stored.map((e) => e.n)).toEqual([1, 2, 3]);
    // `at` never goes below the previous own event
    expect(stored.map((e) => e.at)).toEqual([500, 500, 900]);
    expect(new Set(stored.map((e) => e.dev)).size).toBe(1);
    const next = await appendEvents(db, [intro(100)], newId);
    expect(next[0]).toMatchObject({ n: 4, at: 900, dev: stored[0]?.dev });
  });

  it('never gives two stores of one database the same n', async () => {
    const factory = new IDBFactory();
    const first = await openDatabase(factory);
    const second = await openDatabase(factory);
    const [a, b] = await Promise.all([
      appendEvents(first, drafts(3), newId),
      appendEvents(second, drafts(3), newId),
    ]);
    const all = [...a, ...b];
    expect(new Set(all.map((e) => e.n)).size).toBe(6);
    expect(new Set(all.map((e) => e.dev)).size).toBe(1);
    expect((await readLog(first)).map((e) => e.n)).toEqual([1, 2, 3, 4, 5, 6]);
  });

  it('keeps the open page below LOG_PAGE_EVENTS and closes it under its first n', async () => {
    const db = createMemoryDb();
    await appendEvents(db, drafts(LOG_PAGE_EVENTS - 1), newId);
    expect(await db.get('log', ownPageKey(1))).toBeUndefined();
    expect(await db.get('log', OPEN_PAGE_KEY)).toBeDefined();

    await appendEvents(db, drafts(1, 5000), newId);
    expect(ownPageKey(1)).toBe('own:000000000001');
    expect(await db.get('log', ownPageKey(1))).toBeDefined();
    expect(await db.get('log', OPEN_PAGE_KEY)).toBeUndefined();

    const more = await appendEvents(db, drafts(2, 6000), newId);
    expect(more.map((e) => e.n)).toEqual([501, 502]);
    expect(await db.get('log', OPEN_PAGE_KEY)).toBeDefined();
    expect((await readLog(db)).length).toBe(LOG_PAGE_EVENTS + 2);
  });

  it('splits one large append over pages', async () => {
    const db = createMemoryDb();
    await appendEvents(db, drafts(2 * LOG_PAGE_EVENTS + 5), newId);
    expect(await db.get('log', ownPageKey(1))).toBeDefined();
    expect(await db.get('log', ownPageKey(LOG_PAGE_EVENTS + 1))).toBeDefined();
    expect((await readLog(db)).length).toBe(2 * LOG_PAGE_EVENTS + 5);
  });

  it('replaces an open page that does not continue the log', async () => {
    const db = createMemoryDb();
    await db.put('meta', 'log', { dev: DEV, next: 10, lastAt: 0 });
    await db.put('log', OPEN_PAGE_KEY, { not: 'a page' });
    const stored = await appendEvents(db, drafts(1), newId);
    expect(stored[0]?.n).toBe(10);
    expect((await readLog(db)).map((e) => e.n)).toEqual([10]);
  });
});

describe('readLog', () => {
  it('skips a record that fails its check and drops repeated events', async () => {
    const db = createMemoryDb();
    const stored = await appendEvents(db, drafts(3), newId);
    const [first] = stored;
    await db.put('log', 'own:000000000999', { broken: true });
    // The same events again, as a pulled row of this device would hold them
    await db.put('log', rowPageKey(7), encodePage(stored));
    const events = await readLog(db);
    expect(events.map((e) => e.n)).toEqual([1, 2, 3]);
    expect(events[0]).toEqual(first);
  });

  it('reads pulled rows of other devices in key order', async () => {
    const db = createMemoryDb();
    await appendEvents(db, drafts(1, 100), newId);
    const foreign: LogEvent = { t: 'intro', at: 50, dev: OTHER, n: 1, k: 'hiragana:い' };
    await db.put('log', rowPageKey(42), encodePage([foreign]));
    const events = await readLog(db);
    expect(events.map((e) => e.dev)).toContain(OTHER);
    expect(events).toHaveLength(2);
  });
});

describe('readUnsent', () => {
  it('returns the own events after sentN, across closed pages and the open one', async () => {
    const db = createMemoryDb();
    await appendEvents(db, drafts(LOG_PAGE_EVENTS + 3), newId);
    const foreign: LogEvent = { t: 'intro', at: 50, dev: OTHER, n: 1, k: 'hiragana:い' };
    await db.put('log', rowPageKey(1), encodePage([foreign]));
    expect(await readUnsent(db, 0)).toHaveLength(LOG_PAGE_EVENTS + 3);
    const rest = await readUnsent(db, LOG_PAGE_EVENTS - 2);
    expect(rest.map((e) => e.n)).toEqual([
      LOG_PAGE_EVENTS - 1,
      LOG_PAGE_EVENTS,
      LOG_PAGE_EVENTS + 1,
      LOG_PAGE_EVENTS + 2,
      LOG_PAGE_EVENTS + 3,
    ]);
    expect(await readUnsent(db, LOG_PAGE_EVENTS + 3)).toEqual([]);
  });
});

describe('clearLog', () => {
  it('empties the pages and the keys of meta, and a new identity follows', async () => {
    const db = createMemoryDb();
    const [first] = await appendEvents(db, drafts(2), newId);
    await db.put('meta', 'sentN', 2);
    await db.put('meta', 'pulledId', 5);
    await db.put('meta', 'deviceId', 'keep');
    await db.put('forecasts', 'hiragana:vowels@1', { row: 'x' });
    await clearLog(db);
    expect(await readLog(db)).toEqual([]);
    expect(await db.getAll('forecasts')).toEqual([]);
    expect(await db.get('meta', 'log')).toBeUndefined();
    expect(await db.get('meta', 'sentN')).toBeUndefined();
    expect(await db.get('meta', 'pulledId')).toBeUndefined();
    expect(await db.get('meta', 'deviceId')).toBe('keep');
    const [again] = await appendEvents(db, drafts(1), newId);
    expect(again?.n).toBe(1);
    expect(again?.dev).not.toBe(first?.dev);
  });
});

describe('loadLogMeta', () => {
  it('creates a missing or invalid record once and then returns it', async () => {
    const db: Db = createMemoryDb();
    await db.put('meta', 'log', { dev: 1 });
    const meta = await loadLogMeta(db, newId);
    expect(isLogMeta(meta)).toBe(true);
    expect(meta).toMatchObject({ next: 1, lastAt: 0 });
    expect(await loadLogMeta(db, newId)).toEqual(meta);
  });
});

describe('isLearnMessage', () => {
  it('accepts the three kinds and rejects anything else', () => {
    const page = encodePage([{ t: 'end', at: 1, dev: DEV, n: 1 }]);
    expect(isLearnMessage({ kind: 'append', page })).toBe(true);
    expect(isLearnMessage({ kind: 'pull' })).toBe(true);
    expect(isLearnMessage({ kind: 'reset' })).toBe(true);
    expect(isLearnMessage({ kind: 'append', page: { e: [] } })).toBe(false);
    expect(isLearnMessage('change')).toBe(false);
    expect(isLearnMessage(null)).toBe(false);
  });
});
