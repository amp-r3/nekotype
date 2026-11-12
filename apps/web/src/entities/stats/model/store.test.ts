import { describe, it, expect, vi } from 'vitest';
import type { TestResult } from '@nekotype/shared/types';
import { createMemoryDb } from '@/shared/lib';
import type { ChangeChannel, Db, Write } from '@/shared/lib';
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

function recordedWrites(db: Db): Write[][] {
  const writes: Write[][] = [];
  const original = db.write.bind(db);
  db.write = (batch) => {
    writes.push([...batch]);
    return original(batch);
  };
  return writes;
}

const save = (
  store: TypingStore,
  r: TestResult,
  delta = { [A]: { attempts: 3, erroredAttempts: 1 } },
) => store.saveTest({ result: r, kanaDelta: delta, startedIncrement: 1 });

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
    const failing: Db = { ...db, get: () => Promise.reject(new Error('closed')) };
    const writes = recordedWrites(db);
    const store = createTypingStore({ db: () => Promise.resolve(failing) });
    await store.init();
    expect(store.status.value).toBe('error');
    await save(store, result('r1'));
    expect(writes).toHaveLength(0);
  });

  it('reports a failed write and keeps the state for the page load', async () => {
    const onWriteFailed = vi.fn();
    const failing: Db = { ...createMemoryDb(), write: () => Promise.reject(new Error('quota')) };
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
  const members: { listener: (() => void) | null }[] = [];
  return () => {
    const me: { listener: (() => void) | null } = { listener: null };
    members.push(me);
    return {
      post: () => {
        for (const other of members) if (other !== me) other.listener?.();
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
