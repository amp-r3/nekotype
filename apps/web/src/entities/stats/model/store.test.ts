import { describe, it, expect, vi } from 'vitest';
import type { TestResult } from '@nekotype/shared/types';
import { createMemoryDb, recordWrites } from '@/shared/lib';
import type { ChangeChannel, ChannelMessage, Db } from '@/shared/lib';
import { addCounters, emptyLearnState } from '@nekotype/shared/runtime';
import type { Outbox, Snapshot } from '@nekotype/shared/types';
import { createTypingStore } from './store';
import type { TypingStore } from './store';

function result(id: string, patch: Partial<TestResult> = {}): TestResult {
  return {
    id,
    content: 'words',
    script: 'hiragana',
    strictness: 'learner',
    config: { kind: 'time', seconds: 60 },
    endReason: 'complete',
    repeated: false,
    startedAt: 0,
    endedAt: 60_000,
    durationMs: 60_000,
    tokens: 100,
    erroredTokens: 5,
    items: 20,
    keystrokes: 150,
    rejectedKeystrokes: 6,
    assisted: 0,
    kpm: 100,
    kanaAccuracy: 0.95,
    celebratedPersonalBest: false,
    contentVersion: 'c',
    appVersion: 'a',
    ...patch,
  };
}

const A = 'hiragana:あ';

function setup(db: Db = createMemoryDb(), channel?: ChangeChannel) {
  const store = createTypingStore({
    db: () => Promise.resolve(db),
    ...(channel === undefined ? {} : { channel }),
  });
  return { db, store };
}

const recordedWrites = recordWrites;

const save = (
  store: TypingStore,
  r: TestResult,
  delta = { [A]: { attempts: 3, erroredAttempts: 1 } },
) => store.saveTest({ result: r, kanaDelta: delta, startedIncrement: 1 });

/** A database whose reads work and whose writes fail (quota), through `update` as through `write`. */
function failingWrites(db: Db): Db {
  return {
    ...db,
    write: () => Promise.reject(new Error('quota')),
    update: (reads, compute, scope) =>
      db.update(
        reads,
        (values) => {
          const writes = compute(values);
          if (writes.length > 0) throw new Error('quota');
          return writes;
        },
        scope,
      ),
  };
}

describe('typing store: saving a test (D23)', () => {
  it('writes the result, the delta and the records in one transaction', async () => {
    const { db, store } = setup();
    const writes = recordedWrites(db);
    await store.init();
    await save(store, result('r1'));

    expect(writes).toHaveLength(1);
    expect(writes[0]?.map((w) => `${w.op}:${w.store}/${'key' in w ? w.key : ''}`)).toEqual([
      'put:delta/typing',
      'put:results/r1',
      'put:records/current',
    ]);
    expect(await db.get('results', 'r1')).toMatchObject({ id: 'r1', synced: 0 });
    expect(await db.get('delta', 'typing')).toEqual({
      kanaStats: { [A]: { attempts: 3, erroredAttempts: 1 } },
      counters: { started: { typing: 1, learn: 0 }, finished: { typing: 1, learn: 0 } },
    });
  });

  it('returns the average and the best from before the test and marks a new best', async () => {
    const { store } = setup();
    const first = await save(store, result('r1', { kpm: 80, endedAt: 1 }));
    expect(first).toMatchObject({ average: null, previousBest: null, isBest: true });
    expect(first.result.celebratedPersonalBest).toBe(true);

    const second = await save(store, result('r2', { kpm: 100, endedAt: 2 }));
    expect(second).toMatchObject({ average: 80, previousBest: 80, isBest: true });

    const third = await save(store, result('r3', { kpm: 90, endedAt: 3 }));
    expect(third).toMatchObject({ average: 90, previousBest: 100, isBest: false });
    expect(third.result.celebratedPersonalBest).toBe(false);
    expect(store.records.value['words|hiragana|learner|time:60']?.best?.kpm).toBe(100);
  });

  it('adds the kana statistics and halves a kana past 200 attempts', async () => {
    const { store } = setup();
    await save(store, result('r1'), { [A]: { attempts: 150, erroredAttempts: 30 } });
    await save(store, result('r2'), { [A]: { attempts: 61, erroredAttempts: 11 } });
    // 211 attempts, 41 errored: past 200, both halved.
    expect(store.kanaStats.value[A]).toEqual({ attempts: 105, erroredAttempts: 20 });
  });

  it('counts a discarded test as started only, and writes nothing else', async () => {
    const { db, store } = setup();
    const writes = recordedWrites(db);
    await store.recordDiscarded();
    expect(writes).toHaveLength(1);
    expect(writes[0]?.map((w) => w.store)).toEqual(['delta']);
    expect(store.counters.value.started.typing).toBe(1);
    expect(store.counters.value.finished.typing).toBe(0);
    expect(store.kanaStats.value).toEqual({});
    expect(await db.count('results')).toBe(0);
  });

  it('keeps one delta record and one records entry after 1,000 tests', async () => {
    const { db, store } = setup();
    for (let i = 0; i < 1000; i++) {
      await save(store, result(`r${String(i).padStart(4, '0')}`, { endedAt: i }));
    }
    expect(await db.count('delta')).toBe(1);
    expect(await db.count('records')).toBe(1);
    expect(await db.count('results')).toBe(1000);
    expect(store.counters.value.finished.typing).toBe(1000);
    expect(store.kanaStats.value[A]?.attempts).toBeLessThanOrEqual(200);
  });

  it('never touches the learning record (A39)', async () => {
    const { db, store } = setup();
    const learn = { learn: { marker: 1 }, counters: 'whatever' };
    await db.put('delta', 'learn', learn);
    await save(store, result('r1'));
    await store.recordDiscarded();
    expect(await db.get('delta', 'learn')).toBe(learn);
  });

  it('reads the stored state back', async () => {
    const { db, store } = setup();
    await save(store, result('r1'));
    const again = setup(db).store;
    await again.init();
    expect(again.kanaStats.value[A]).toEqual({ attempts: 3, erroredAttempts: 1 });
    expect(again.counters.value.finished.typing).toBe(1);
    expect(again.records.value['words|hiragana|learner|time:60']?.best?.resultId).toBe('r1');
    expect(again.status.value).toBe('ready');
  });

  it('starts from nothing when a stored record fails validation', async () => {
    const db = createMemoryDb();
    await db.put('delta', 'typing', { kanaStats: 'nope' });
    const { store } = setup(db);
    await store.init();
    expect(store.status.value).toBe('ready');
    expect(store.kanaStats.value).toEqual({});
  });

  it('writes nothing after a failed read, so the stored record is not replaced', async () => {
    const db = createMemoryDb();
    const failing: Db = { ...db, update: () => Promise.reject(new Error('closed')) };
    const writes = recordedWrites(db);
    const store = createTypingStore({ db: () => Promise.resolve(failing) });
    await store.init();
    expect(store.status.value).toBe('error');
    await save(store, result('r1'));
    expect(writes).toHaveLength(0);
  });

  it('reports a failed write and keeps the state for the page load', async () => {
    const onWriteFailed = vi.fn();
    const failing: Db = failingWrites(createMemoryDb());
    const store = createTypingStore({ db: () => Promise.resolve(failing), onWriteFailed });
    await save(store, result('r1'));
    expect(onWriteFailed).toHaveBeenCalledTimes(1);
    expect(store.counters.value.finished.typing).toBe(1);
  });
});

describe('typing store: reset', () => {
  it('clears results, records and the typing delta, and nothing else', async () => {
    const { db, store } = setup();
    await db.put('delta', 'learn', { learn: 1 });
    await db.put('settings', 'current', { s: 1 });
    await save(store, result('r1'));
    await store.reset();

    expect(await db.count('results')).toBe(0);
    expect(await db.get('delta', 'typing')).toBeUndefined();
    expect(await db.get('records', 'current')).toBeUndefined();
    expect(await db.get('delta', 'learn')).toEqual({ learn: 1 });
    expect(await db.get('settings', 'current')).toEqual({ s: 1 });
    expect(store.kanaStats.value).toEqual({});
    expect(store.records.value).toEqual({});
    expect(store.counters.value.finished.typing).toBe(0);
  });
});

/** Two or more tabs: a post of one reaches the listeners of the others. */
function channelBus(): () => ChangeChannel {
  type Member = { listener: ((message: ChannelMessage) => void) | null };
  const members: Member[] = [];
  return () => {
    const me: Member = { listener: null };
    members.push(me);
    return {
      post: (message = 'change') => {
        for (const other of members) if (other !== me) other.listener?.(message);
      },
      listen: (onChange) => {
        me.listener = onChange;
      },
    };
  };
}

describe('typing store: two tabs', () => {
  it('reads the state another tab wrote', async () => {
    const db = createMemoryDb();
    const newChannel = channelBus();
    const a = setup(db, newChannel()).store;
    const b = setup(db, newChannel()).store;
    await a.init();
    await b.init();

    await save(a, result('r1', { kpm: 90 }));
    await b.flush();

    expect(b.kanaStats.value[A]).toEqual({ attempts: 3, erroredAttempts: 1 });
    expect(b.counters.value.finished.typing).toBe(1);
    expect(b.records.value['words|hiragana|learner|time:60']?.best?.kpm).toBe(90);
  });
});

describe('typing store: reset in another tab', () => {
  it('drops what the tab held, and its next write does not bring the old state back', async () => {
    const db = createMemoryDb();
    const newChannel = channelBus();
    const a = setup(db, newChannel()).store;
    const b = setup(db, newChannel()).store;
    await a.init();
    await b.init();
    await save(a, result('r1'));
    await b.flush();
    expect(b.counters.value.finished.typing).toBe(1);

    await a.reset();
    await b.flush();
    expect(b.kanaStats.value).toEqual({});
    expect(b.records.value).toEqual({});
    expect(b.counters.value.started.typing).toBe(0);
    expect(b.counters.value.finished.typing).toBe(0);

    await b.recordDiscarded();
    expect(await db.get('delta', 'typing')).toEqual({
      kanaStats: {},
      counters: { started: { typing: 1, learn: 0 }, finished: { typing: 0, learn: 0 } },
    });
    expect(await db.get('records', 'current')).toBeUndefined();
    expect(await db.count('results')).toBe(0);
  });
});

describe('typing store: a test after a failed read', () => {
  it('writes nothing and reports it, so the screen does not pretend it was kept', async () => {
    const failing: Db = { ...createMemoryDb(), update: () => Promise.reject(new Error('closed')) };
    const onWriteFailed = vi.fn();
    const store = createTypingStore({ db: () => Promise.resolve(failing), onWriteFailed });
    const writes = recordedWrites(failing);
    await save(store, result('r1'));
    expect(store.status.value).toBe('error');
    expect(writes).toHaveLength(0);
    expect(onWriteFailed).toHaveBeenCalledTimes(1);
  });
});

describe('typing store: reading saved results', () => {
  it('returns every result, oldest first', async () => {
    const { store } = setup();
    await save(store, result('a', { endedAt: 1000 }));
    await save(store, result('b', { endedAt: 3000, repeated: true }));
    await save(store, result('c', { endedAt: 2000 }));

    expect((await store.allResults()).map((r) => r.id)).toEqual(['a', 'c', 'b']);
  });

  it('reads after the write in progress', async () => {
    const { store } = setup();
    const saving = save(store, result('a', { endedAt: 1000 }));
    const rows = await store.allResults();
    await saving;
    expect(rows.map((r) => r.id)).toEqual(['a']);
  });

  it('skips an invalid row and still returns the rows older than it', async () => {
    const { db, store } = setup();
    await save(store, result('old', { endedAt: 1000 }));
    await save(store, result('new', { endedAt: 3000 }));
    await db.put('results', 'broken', { id: 'broken', endedAt: 2000 });
    expect((await store.allResults()).map((r) => r.id)).toEqual(['old', 'new']);
  });

  it('rejects when the database cannot be read', async () => {
    const store = createTypingStore({ db: () => Promise.reject(new Error('closed')) });
    await expect(store.allResults()).rejects.toThrow('closed');
  });
});

describe('typing store: the view is snapshot, outbox and delta merged (D18)', () => {
  const counters = (typing: number) => ({
    started: { typing, learn: 0 },
    finished: { typing, learn: 0 },
  });
  const entry = (id: string, kpm: number, endedAt: number) => ({
    best: { kpm, resultId: id },
    recent: [{ resultId: id, endedAt, kpm }],
  });
  const key = 'words|hiragana|learner|time:60';
  const snapshot: Snapshot = {
    settings: null,
    kanaStats: { [A]: { attempts: 10, erroredAttempts: 2 } },
    counters: counters(5),
    learn: emptyLearnState(),
    typingRecords: { [key]: entry('s', 90, 10) },
  };
  const outbox: Outbox = {
    seq: 1,
    resultIds: ['o'],
    request: {
      v: 1,
      deviceId: 'd',
      seq: 1,
      results: [],
      delta: {
        kanaStats: { [A]: { attempts: 4, erroredAttempts: 1 } },
        counters: counters(1),
        learn: emptyLearnState(),
        settings: null,
      },
    },
  };

  it('equals the merge of the three, the records included', async () => {
    const db = createMemoryDb();
    await db.put('snapshot', 'current', snapshot);
    await db.put('outbox', 'current', outbox);
    await db.put('delta', 'typing', {
      kanaStats: { [A]: { attempts: 3, erroredAttempts: 0 } },
      counters: counters(2),
    });
    await db.put('records', 'current', { [key]: entry('l', 110, 20) });
    const { store } = setup(db);
    await store.init();
    expect(store.kanaStats.value[A]).toEqual({ attempts: 17, erroredAttempts: 3 });
    expect(store.counters.value).toEqual(
      addCounters(addCounters(counters(5), counters(1)), counters(2)),
    );
    expect(store.records.value[key]?.best).toEqual({ kpm: 110, resultId: 'l' });
    expect(store.records.value[key]?.recent.map((r) => r.resultId)).toEqual(['s', 'l']);
  });

  it('keeps the statistics visible with only an outbox', async () => {
    const db = createMemoryDb();
    await db.put('outbox', 'current', outbox);
    const { store } = setup(db);
    await store.init();
    expect(store.kanaStats.value[A]).toEqual({ attempts: 4, erroredAttempts: 1 });
    expect(store.counters.value.finished.typing).toBe(1);
  });

  it('reads the records of a snapshot whose statistics are broken', async () => {
    const db = createMemoryDb();
    await db.put('snapshot', 'current', { ...snapshot, learn: 'broken', counters: {} });
    const { store } = setup(db);
    await store.init();
    expect(store.kanaStats.value).toEqual({});
    expect(store.counters.value.finished.typing).toBe(0);
    expect(store.records.value[key]?.best).toEqual({ kpm: 90, resultId: 's' });
  });

  it('counts a test on top of the snapshot and writes only its own change to the delta', async () => {
    const db = createMemoryDb();
    await db.put('snapshot', 'current', snapshot);
    const { store } = setup(db);
    await store.init();
    await save(store, result('t1', { kpm: 120 }));
    expect(store.counters.value.finished.typing).toBe(6);
    expect(store.kanaStats.value[A]).toEqual({ attempts: 13, erroredAttempts: 3 });
    expect(await db.get('delta', 'typing')).toEqual({
      kanaStats: { [A]: { attempts: 3, erroredAttempts: 1 } },
      counters: { started: { typing: 1, learn: 0 }, finished: { typing: 1, learn: 0 } },
    });
    expect(await db.get('snapshot', 'current')).toEqual(snapshot);
  });

  it('counts the tests of two tabs that save at once', async () => {
    const db = createMemoryDb();
    const newChannel = channelBus();
    const a = setup(db, newChannel()).store;
    const b = setup(db, newChannel()).store;
    await a.init();
    await b.init();
    await Promise.all([
      save(a, result('a1', { endedAt: 1000 })),
      save(b, result('b1', { endedAt: 2000 })),
    ]);
    await a.flush();
    await b.flush();
    for (const store of [a, b]) {
      expect(store.counters.value.finished.typing).toBe(2);
      expect(store.kanaStats.value[A]).toEqual({ attempts: 6, erroredAttempts: 2 });
      expect(Object.values(store.records.value)[0]?.recent).toHaveLength(2);
    }
  });
});

describe('typing store: older results from the server', () => {
  /** A fake `GET /api/results`: the server's history, newest first, with the cursor rules of the API. */
  function fakeServer(history: readonly TestResult[], pageSize = 50) {
    const sorted = history.slice().sort((a, b) => b.endedAt - a.endedAt || (a.id < b.id ? 1 : -1));
    const cursors: (string | null)[] = [];
    const fetchOlder = (before: string | null) => {
      cursors.push(before);
      const start =
        before === null
          ? 0
          : sorted.findIndex((item) => `${item.endedAt}:${item.id}` === before) + 1;
      const results = sorted.slice(start, start + pageSize);
      const last = results.at(-1);
      const more = start + pageSize < sorted.length;
      return Promise.resolve({
        kind: 'ok' as const,
        results,
        next: more && last !== undefined ? `${last.endedAt}:${last.id}` : null,
      });
    };
    return { fetchOlder, cursors };
  }

  const history = (count: number): TestResult[] =>
    Array.from({ length: count }, (_, index) =>
      // Four results share each time, so the cursor has to break ties by id.
      result(`r-${String(index).padStart(3, '0')}`, {
        endedAt: 10_000 + Math.floor(index / 4) * 1000,
      }),
    );

  function withServer(server: ReturnType<typeof fakeServer>, db: Db = createMemoryDb()) {
    const store = createTypingStore({
      db: () => Promise.resolve(db),
      fetchOlder: server.fetchOlder,
    });
    return { db, store };
  }

  it('fills an empty device page by page, with synced = 1, until the server has no more', async () => {
    const server = fakeServer(history(120));
    const { store } = withServer(server);
    expect(store.older.value).toBe('unknown');

    expect(await store.loadOlder()).toBe(true);
    expect(store.older.value).toBe('unknown');
    expect(await store.loadOlder()).toBe(true);
    expect(await store.loadOlder()).toBe(true);
    expect(store.older.value).toBe('exhausted');
    // Nothing is asked for again once the server has said it has no more.
    expect(await store.loadOlder()).toBe(false);
    expect(server.cursors).toHaveLength(3);
    expect(server.cursors[0]).toBeNull();

    const all = await store.allResults();
    expect(all).toHaveLength(120);
    expect(new Set(all.map((item) => item.id)).size).toBe(120);
  });

  it('asks with the oldest result held as the cursor and stores the page as synced', async () => {
    const server = fakeServer(history(10));
    const db = createMemoryDb();
    await db.put('results', 'r-009', { ...result('r-009', { endedAt: 12_000 }), synced: 1 });
    const { store } = withServer(server, db);
    await store.init();
    await store.loadOlder();
    expect(server.cursors).toEqual(['12000:r-009']);
    const stored = await db.getAll('results', 'endedAt');
    expect(stored).toHaveLength(10);
    expect(
      stored.every(
        (row) => typeof row === 'object' && row !== null && 'synced' in row && row.synced === 1,
      ),
    ).toBe(true);
  });

  it('inserting twice changes nothing, and an unsent result stays unsent', async () => {
    const server = fakeServer(history(6));
    const db = createMemoryDb();
    const { store } = withServer(server, db);
    await store.init();
    // An unsent result the server also lists (a resent batch, a lost acknowledgement).
    await db.put('results', 'r-005', { ...result('r-005', { endedAt: 11_000 }), synced: 0 });
    await store.loadOlder();
    const before = await db.getAll('results', 'endedAt');
    // The same page again, as another tab's request or a retry would deliver it.
    const again = await server.fetchOlder(null);
    await db.update(
      again.results.map((item) => ({ store: 'results', key: item.id })),
      () => [],
    );
    await store.loadOlder();
    expect(await db.getAll('results', 'endedAt')).toEqual(before);
    expect(await db.get('results', 'r-005')).toMatchObject({ synced: 0 });
  });

  it('a failed request is remembered and changes nothing', async () => {
    const db = createMemoryDb();
    const store = createTypingStore({
      db: () => Promise.resolve(db),
      fetchOlder: () => Promise.resolve({ kind: 'failed' }),
    });
    expect(await store.loadOlder()).toBe(false);
    expect(store.older.value).toBe('failed');
    expect(await store.allResults()).toEqual([]);
    // A later call tries again.
    expect(await store.loadOlder()).toBe(false);
  });

  it('a failed write is a failed request, not an exception', async () => {
    const server = fakeServer(history(3));
    const { store } = withServer(server, failingWrites(createMemoryDb()));
    expect(await store.loadOlder()).toBe(false);
    expect(store.older.value).toBe('failed');
  });

  it('does not run two requests at once', async () => {
    const server = fakeServer(history(3));
    const { store } = withServer(server);
    const [first, second] = await Promise.all([store.loadOlder(), store.loadOlder()]);
    expect([first, second]).toEqual([true, false]);
    expect(server.cursors).toHaveLength(1);
  });

  it('reset forgets that the server had no more', async () => {
    const server = fakeServer(history(3));
    const { store } = withServer(server);
    await store.loadOlder();
    expect(store.older.value).toBe('exhausted');
    await store.reset();
    expect(store.older.value).toBe('unknown');
  });
});
