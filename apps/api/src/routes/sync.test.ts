import { env } from 'cloudflare:workers';
import {
  applyBatch,
  isLearnKanaKey,
  isObject,
  isSnapshotBuckets,
  isSnapshotRecent,
  isSnapshotRest,
  patchBuckets,
  patchLearn,
  patchRecent,
} from '@nekotype/shared/runtime';
import {
  DEVICE_ID,
  KANA_KEYS,
  LAST_SEQ,
  YEAR_FIRST_DAY,
  applyMergePatch,
  generateBatch,
  generateYear,
} from '@nekotype/shared/testing';
import type { Year } from '@nekotype/shared/testing';
import type {
  Counters,
  LearnDelta,
  LearnKanaKey,
  Snapshot,
  SyncDelta,
  SyncRequest,
  TestResult,
  ValidSettings,
} from '@nekotype/shared/types';
import { describe, expect, it } from 'vitest';
import { createApp } from '../app';
import { countingDb, newestDays, seedYear, signedInUser } from '../test-support';
import { testDeps } from '../test-deps';

const DAY = 24 * 60 * 60 * 1000;
const START = 1_700_000_000_000;
const A = '11111111-1111-4111-8111-111111111111';
const B = '22222222-2222-4222-8222-222222222222';
const origin = { Origin: 'http://localhost:5173' };
const hiragana = KANA_KEYS.hiragana;

function kana(keys: readonly LearnKanaKey[], index: number): LearnKanaKey {
  const key = keys[index];
  if (key === undefined) throw new Error(`no kana at ${index}`);
  return key;
}
const katakana = KANA_KEYS.katakana;

let userCount = 0;
const nextUserId = (): string => `user-${(userCount += 1)}`;

type Setup = ReturnType<typeof setup>;

function setup(options: { interval?: string; db?: D1Database; start?: number } = {}) {
  const { deps, clock } = testDeps({}, options.start ?? START);
  const app = createApp(deps);
  const bindings = {
    ...env,
    SYNC_MIN_INTERVAL_MS: options.interval ?? '0',
    DB: options.db ?? env.DB,
  };
  const call = (path: string, init?: RequestInit) => app.request(path, init, bindings);
  return { call, clock };
}

async function newUser(start = START) {
  const id = nextUserId();
  const { cookie } = await signedInUser(env.DB, id, start);
  return { id, cookie };
}

const post = (s: Setup, cookie: string, body: unknown, headers: Record<string, string> = origin) =>
  s.call('/api/sync', {
    method: 'POST',
    headers: { ...headers, Cookie: cookie, 'content-type': 'application/json' },
    body: typeof body === 'string' ? body : JSON.stringify(body),
  });

const get = (s: Setup, cookie: string, query: string) =>
  s.call(`/api/sync?${query}`, { headers: { Cookie: cookie } });

const zeroCounters = (): Counters => ({
  started: { typing: 0, learn: 0 },
  finished: { typing: 0, learn: 0 },
});

const emptyLearn = (): LearnDelta => ({
  entries: {},
  unlocked: { hiragana: [], katakana: [] },
  recent: {},
  stats: {},
  activeDays: [],
  recallBuckets: { hiragana: {}, katakana: {} },
});

function request(
  seq: number,
  over: {
    deviceId?: string;
    learn?: Partial<LearnDelta>;
    counters?: Counters;
    settings?: ValidSettings | null;
    kanaStats?: SyncDelta['kanaStats'];
    results?: readonly TestResult[];
  } = {},
): SyncRequest {
  return {
    v: 1,
    deviceId: over.deviceId ?? A,
    seq,
    delta: {
      kanaStats: over.kanaStats ?? {},
      counters: over.counters ?? zeroCounters(),
      learn: { ...emptyLearn(), ...over.learn },
      settings: over.settings ?? null,
    },
    results: over.results ?? [],
  };
}

const learned = (count = 1): Counters => ({
  started: { typing: 0, learn: count },
  finished: { typing: 0, learn: count },
});

function settings(updatedAt: number, targetMs = 1500): ValidSettings {
  return {
    typing: {
      script: 'both',
      content: 'words',
      strictness: 'learner',
      weakFocus: true,
      test: { kind: 'time', seconds: 30 },
      showTranslation: true,
    },
    learn: { strictness: 'learner', track: 'hiragana', targetMs, sound: true },
    updatedAt,
  };
}

function result(index: number, endedAt = START + index * 60_000): TestResult {
  return {
    id: `0192f0a0-${String(userCount).padStart(4, '0')}-7000-8000-${String(index).padStart(12, '0')}`,
    content: 'words',
    script: 'hiragana',
    strictness: 'learner',
    config: { kind: 'time', seconds: 60 },
    endReason: 'complete',
    repeated: false,
    startedAt: endedAt - 60_000,
    endedAt,
    durationMs: 60_000,
    tokens: 100,
    erroredTokens: 5,
    items: 20,
    keystrokes: 150,
    rejectedKeystrokes: 5,
    assisted: 0,
    kpm: 80 + index,
    kanaAccuracy: 0.95,
    celebratedPersonalBest: false,
    contentVersion: 'c1',
    appVersion: 'a1',
  };
}

async function json(response: Response): Promise<unknown> {
  return response.json();
}

/** The three parts of `GET /api/sync`, which must agree on the version, as one snapshot. */
async function snapshotOf(
  s: Setup,
  cookie: string,
  deviceId = A,
): Promise<{ snapshot: Snapshot; version: number; lastSeq: number }> {
  const [rest, recent, buckets] = await Promise.all(
    ['rest', 'recent', 'buckets'].map(async (part) =>
      json(await get(s, cookie, `deviceId=${deviceId}&part=${part}`)),
    ),
  );
  if (!isSnapshotRest(rest) || !isSnapshotRecent(recent) || !isSnapshotBuckets(buckets)) {
    throw new Error('a part of the snapshot is malformed');
  }
  expect(recent.version).toBe(rest.version);
  expect(buckets.version).toBe(rest.version);
  return {
    version: rest.version,
    lastSeq: rest.lastSeq,
    snapshot: {
      settings: rest.settings,
      kanaStats: rest.kanaStats,
      counters: rest.counters,
      learn: { ...rest.learn, recent: recent.recent, recallBuckets: buckets.recallBuckets },
      typingRecords: rest.typingRecords,
    },
  };
}

const fresh: Snapshot = {
  settings: null,
  kanaStats: {},
  counters: zeroCounters(),
  learn: {
    unlocked: { hiragana: [], katakana: [] },
    entries: {},
    recent: {},
    stats: {},
    activeDays: [],
    recallBuckets: { hiragana: {}, katakana: {} },
  },
  typingRecords: {},
};

async function column(userId: string, name: string): Promise<unknown> {
  const row = await env.DB.prepare(`SELECT ${name} AS value FROM user_stats WHERE user_id = ?`)
    .bind(userId)
    .first();
  const value = isObject(row) ? row['value'] : null;
  if (typeof value !== 'string') throw new Error(`${name} is not text`);
  const parsed: unknown = JSON.parse(value);
  return parsed;
}

async function count(table: string, userId: string): Promise<number> {
  const row = await env.DB.prepare(`SELECT count(*) AS n FROM ${table} WHERE user_id = ?`)
    .bind(userId)
    .first();
  return isObject(row) ? Number(row['n']) : -1;
}

/** The entries of `source` for `keys`: what a read by path would return. */
function pickKeys<T>(source: Readonly<Record<LearnKanaKey, T>>, keys: readonly string[]) {
  const out: Record<LearnKanaKey, T> = {};
  for (const key of keys) {
    if (!isLearnKanaKey(key)) continue;
    const value = source[key];
    if (value !== undefined) out[key] = value;
  }
  return out;
}

const entry = (updatedAt: number, box: 0 | 1 | 2 | 3 | 4 | 5 = 1) => ({
  box,
  dueAt: updatedAt + DAY,
  updatedAt,
});
const answer = (at: number, ms = 900, ok = true) => ({ at, ms, ok });
const stat = (recognitions: number, errors = 0, mixups: Record<string, number> = {}) => ({
  recognitions,
  recognitionErrors: errors,
  mixups,
});

describe('POST /api/sync: checks', () => {
  it('answers 403 without the right Origin, before the session', async () => {
    const s = setup();
    const { cookie } = await newUser();
    expect((await post(s, cookie, request(1), {})).status).toBe(403);
    expect((await post(s, '', request(1), { Origin: 'https://evil.example' })).status).toBe(403);
    expect(await json(await post(s, cookie, request(1), {}))).toEqual({
      error: { code: 'bad_origin' },
    });
  });

  it('answers 401 without a session, to GET and to POST', async () => {
    const s = setup();
    expect((await post(s, '', request(1))).status).toBe(401);
    expect((await get(s, '', `deviceId=${A}`)).status).toBe(401);
    expect((await post(s, 'nt_session=unknown', request(1))).status).toBe(401);
  });

  it('answers 413 over 256 KB, before the session and the schema', async () => {
    const s = setup();
    const response = await post(s, '', `{"padding":"${'x'.repeat(300_000)}"}`);
    expect(response.status).toBe(413);
    expect(await json(response)).toEqual({ error: { code: 'too_large' } });
  });

  const learning = generateBatch({ seed: 3, keys: KANA_KEYS, kind: 'learning' });
  const withLearn = (patch: Record<string, unknown>) => ({
    ...request(1),
    delta: { ...request(1).delta, learn: { ...emptyLearn(), ...patch } },
  });
  const bad: [string, unknown][] = [
    ['not JSON', '{'],
    ['an empty body', ''],
    ['an array', '[]'],
    ['another format version', { ...request(1), v: 2 }],
    ['a device id that is not a UUID', { ...request(1), deviceId: 'device-a' }],
    ['seq 0', request(0)],
    ['a fractional seq', request(1.5)],
    ['an unknown key', { ...request(1), extra: true }],
    ['an unknown key in the delta', { ...request(1), delta: { ...request(1).delta, extra: 1 } }],
    ['51 results', request(1, { results: Array.from({ length: 51 }, (_, i) => result(i)) })],
    ['a result with a bad id', request(1, { results: [{ ...result(1), id: 'r1' }] })],
    ['a kana key of another script', withLearn({ entries: { 'latin:a': entry(1) } })],
    [
      '61 kana',
      withLearn({
        entries: Object.fromEntries(
          [...hiragana, ...katakana].slice(0, 61).map((key) => [key, entry(1)]),
        ),
      }),
    ],
    [
      '32 days of a track',
      withLearn({
        recallBuckets: {
          hiragana: Object.fromEntries(
            Array.from({ length: 32 }, (_, i) => [`${20_000 + i}`, { '1': 1 }]),
          ),
          katakana: {},
        },
      }),
    ],
    [
      '11 recent answers',
      withLearn({
        recent: { [kana(hiragana, 0)]: Array.from({ length: 11 }, (_, i) => answer(i)) },
      }),
    ],
    [
      'bucket 101',
      withLearn({ recallBuckets: { hiragana: { '20000': { '101': 1 } }, katakana: {} } }),
    ],
    ['a negative count', request(1, { counters: learned(-1) })],
  ];
  it.each(bad)('answers 400 for %s', async (_name, body) => {
    const s = setup();
    const { cookie } = await newUser();
    const response = await post(s, cookie, body);
    expect(response.status).toBe(400);
    expect(await json(response)).toEqual({ error: { code: 'invalid_body' } });
  });

  it('accepts a generated batch', async () => {
    const s = setup();
    const { cookie } = await newUser();
    expect((await post(s, cookie, { ...learning, seq: 1 })).status).toBe(200);
  });
});

describe('POST /api/sync: seq', () => {
  it('applies last + 1, answers a resent batch without applying it, and refuses a gap', async () => {
    const s = setup();
    const { id, cookie } = await newUser();

    const first = await post(s, cookie, request(1, { counters: learned() }));
    expect(first.status).toBe(200);
    expect(await json(first)).toEqual({ lastSeq: 1, version: 1 });

    // The same batch again: acknowledged, and nothing is counted twice.
    expect(await json(await post(s, cookie, request(1, { counters: learned() })))).toEqual({
      lastSeq: 1,
      version: 1,
    });
    expect((await snapshotOf(s, cookie)).snapshot.counters).toEqual(learned());

    const gap = await post(s, cookie, request(3, { counters: learned() }));
    expect(gap.status).toBe(409);
    expect(await json(gap)).toEqual({ error: { code: 'seq_gap', lastSeq: 1 } });

    expect(await json(await post(s, cookie, request(2, { counters: learned() })))).toEqual({
      lastSeq: 2,
      version: 2,
    });
    // A delayed old batch is not applied.
    expect(await json(await post(s, cookie, request(1, { counters: learned(5) })))).toEqual({
      lastSeq: 2,
      version: 2,
    });
    expect((await snapshotOf(s, cookie)).snapshot.counters).toEqual(learned(2));
    expect(await count('user_stats', id)).toBe(1);
  });

  it('keeps a `seq` per device', async () => {
    const s = setup();
    const { cookie } = await newUser();
    await post(s, cookie, request(1, { counters: learned() }));
    const other = await post(s, cookie, request(1, { deviceId: B, counters: learned() }));
    expect(await json(other)).toEqual({ lastSeq: 1, version: 2 });
    expect(await json(await get(s, cookie, `deviceId=${A}`))).toEqual({ lastSeq: 1, version: 2 });
    expect(await json(await get(s, cookie, `deviceId=${B}`))).toEqual({ lastSeq: 1, version: 2 });
    expect(
      await json(await get(s, cookie, 'deviceId=33333333-3333-4333-8333-333333333333')),
    ).toEqual({ lastSeq: 0, version: 2 });
  });

  it('does not insert a result twice, resent or sent again in another batch', async () => {
    const s = setup();
    const { id, cookie } = await newUser();
    const results = [result(1), result(2)];
    await post(s, cookie, request(1, { results }));
    await post(s, cookie, request(1, { results }));
    expect(await count('results', id)).toBe(2);
    await post(s, cookie, request(2, { results: [result(2), result(3)] }));
    expect(await count('results', id)).toBe(3);
  });

  it('limits an applied batch to one per interval, and not a resent one', async () => {
    const s = setup({ interval: '5000' });
    const { cookie } = await newUser();
    expect((await post(s, cookie, request(1, { counters: learned() }))).status).toBe(200);

    const early = await post(s, cookie, request(2, { counters: learned() }));
    expect(early.status).toBe(429);
    expect(early.headers.get('Retry-After')).toBe('5');
    expect(await json(early)).toEqual({ error: { code: 'rate_limited' } });

    s.clock.time += 2000;
    expect(
      (await post(s, cookie, request(2, { counters: learned() }))).headers.get('Retry-After'),
    ).toBe('3');
    // A batch that is already applied writes nothing, so the interval does not concern it.
    expect((await post(s, cookie, request(1, { counters: learned() }))).status).toBe(200);
    // A gap is answered before the limit.
    expect((await post(s, cookie, request(9, { counters: learned() }))).status).toBe(409);

    s.clock.time += 3000;
    expect((await post(s, cookie, request(2, { counters: learned() }))).status).toBe(200);
  });
});

describe('POST /api/sync: the merge rules on stored data', () => {
  it('merges entries by `updatedAt`, answers by `at`, and adds statistics and buckets', async () => {
    const s = setup();
    const { cookie } = await newUser();
    const [a, i] = [kana(hiragana, 0), kana(hiragana, 1)];
    const first = request(1, {
      learn: {
        entries: { [a]: entry(2000, 2) },
        unlocked: { hiragana: [i, a], katakana: [] },
        recent: { [a]: [answer(1), answer(2)] },
        stats: { [a]: stat(4, 1, { [i]: 2 }) },
        activeDays: [[10, 12]],
        recallBuckets: { hiragana: { '20000': { '5': 2 } }, katakana: {} },
      },
    });
    const second = request(2, {
      learn: {
        entries: { [a]: entry(1000, 5) },
        unlocked: { hiragana: [a], katakana: [kana(katakana, 0)] },
        recent: { [a]: [answer(2), answer(3)] },
        stats: { [a]: stat(1, 0, { [i]: 1 }) },
        activeDays: [[13, 14]],
        recallBuckets: { hiragana: { '20000': { '5': 1, '6': 1 } }, katakana: {} },
      },
    });
    await post(s, cookie, first);
    await post(s, cookie, second);
    const { snapshot } = await snapshotOf(s, cookie);

    // The older entry does not win.
    expect(snapshot.learn.entries[a]).toEqual(entry(2000, 2));
    // Unlocked kana are a union, sorted by key.
    expect(snapshot.learn.unlocked.hiragana).toEqual([a, i].sort());
    expect(snapshot.learn.unlocked.katakana).toEqual([katakana[0]]);
    expect(snapshot.learn.recent[a]?.map((item) => item.at)).toEqual([1, 2, 3]);
    expect(snapshot.learn.stats[a]).toEqual(stat(5, 1, { [i]: 3 }));
    expect(snapshot.learn.activeDays).toEqual([[10, 14]]);
    expect(snapshot.learn.recallBuckets.hiragana).toEqual({ '20000': { '5': 3, '6': 1 } });
    expect(snapshot).toEqual(applyBatch(applyBatch(fresh, first), second));
  });

  it('counts a typing batch and keeps the records of its results', async () => {
    const s = setup();
    const { id, cookie } = await newUser();
    const batch = request(1, {
      counters: { started: { typing: 2, learn: 0 }, finished: { typing: 2, learn: 0 } },
      kanaStats: { [kana(hiragana, 0)]: { attempts: 10, erroredAttempts: 2 } },
      results: [result(2), result(1), result(3)],
    });
    await post(s, cookie, batch);
    const { snapshot } = await snapshotOf(s, cookie);
    expect(snapshot).toEqual(applyBatch(fresh, batch));
    expect(Object.keys(snapshot.typingRecords)).toHaveLength(1);
    expect(await count('results', id)).toBe(3);
    const row = await env.DB.prepare('SELECT config, json FROM results WHERE id = ?')
      .bind(result(1).id)
      .first();
    expect(isObject(row) ? row['config'] : null).toBe('time:60');
    expect(isObject(row) ? String(row['json']) : '').toContain(result(1).id);
  });

  it('names a dropped `mixups` key with null: the stored statistics equal the full merge', async () => {
    const s = setup();
    const { cookie } = await newUser();
    const a = kana(hiragana, 0);
    // 199 recognitions, then 3 more: the total passes 200 and every counter is halved.
    const mixups = Object.fromEntries(
      hiragana.slice(1, 4).map((key, n) => [key, n === 0 ? 1 : 10]),
    );
    const first = request(1, { learn: { stats: { [a]: stat(199, 3, mixups) } } });
    const second = request(2, { learn: { stats: { [a]: stat(3, 0, {}) } } });
    await post(s, cookie, first);
    await post(s, cookie, second);
    const { snapshot } = await snapshotOf(s, cookie);
    const merged = snapshot.learn.stats[a];
    expect(merged?.recognitions).toBe(101);
    // The key with a count of 1 is halved to 0 and removed.
    expect(Object.keys(merged?.mixups ?? {})).toHaveLength(2);
    expect(snapshot).toEqual(applyBatch(applyBatch(fresh, first), second));
  });

  it('drops bucket days that fall more than 365 days behind the newest', async () => {
    const s = setup();
    const { id, cookie } = await newUser();
    const days = (...list: number[]) =>
      Object.fromEntries(list.map((day) => [String(day), { '5': 1 }]));
    const first = request(1, {
      learn: { recallBuckets: { hiragana: days(100, 200, 300), katakana: days(50) } },
    });
    const second = request(2, {
      learn: { recallBuckets: { hiragana: days(300, 466), katakana: {} } },
    });
    await post(s, cookie, first);
    await post(s, cookie, second);
    const { snapshot } = await snapshotOf(s, cookie);
    // 466 - 365 = 101: day 100 leaves, 200 and 300 stay.
    expect(Object.keys(snapshot.learn.recallBuckets.hiragana).sort()).toEqual([
      '200',
      '300',
      '466',
    ]);
    expect(snapshot.learn.recallBuckets.hiragana['300']).toEqual({ '5': 2 });
    expect(await column(id, 'bucket_newest')).toEqual({ hiragana: 466, katakana: 50 });
    expect(snapshot).toEqual(applyBatch(applyBatch(fresh, first), second));
  });
});

describe('POST /api/sync: settings', () => {
  it('lets the account win on seq 1 and the newer write win later', async () => {
    const s = setup();
    const { id, cookie } = await newUser();
    await env.DB.prepare('INSERT INTO user_settings (user_id, json, updated_at) VALUES (?, ?, ?)')
      .bind(id, JSON.stringify(settings(100, 1000)), 100)
      .run();

    await post(s, cookie, request(1, { settings: settings(500, 2000) }));
    expect((await snapshotOf(s, cookie)).snapshot.settings).toEqual(settings(100, 1000));

    await post(s, cookie, request(2, { settings: settings(50, 2500) }));
    expect((await snapshotOf(s, cookie)).snapshot.settings).toEqual(settings(100, 1000));

    await post(s, cookie, request(3, { settings: settings(700, 3000) }));
    expect((await snapshotOf(s, cookie)).snapshot.settings).toEqual(settings(700, 3000));
  });

  it('stores the first settings of an account whatever the seq', async () => {
    const s = setup();
    const { cookie } = await newUser();
    expect((await snapshotOf(s, cookie)).snapshot.settings).toBeNull();
    await post(s, cookie, request(1, { settings: settings(500, 2000) }));
    expect((await snapshotOf(s, cookie)).snapshot.settings).toEqual(settings(500, 2000));
  });
});

describe('two devices', () => {
  const generated = (seed: number, deviceId: string): SyncRequest => ({
    ...generateBatch({ seed, keys: KANA_KEYS, kind: 'learning' }),
    deviceId,
    seq: 1,
  });

  it('converge whichever batch arrives first', async () => {
    const s = setup();
    const one = await newUser();
    const two = await newUser();
    const a = generated(11, A);
    const b = generated(12, B);
    await post(s, one.cookie, a);
    await post(s, one.cookie, b);
    await post(s, two.cookie, b);
    await post(s, two.cookie, a);
    const first = (await snapshotOf(s, one.cookie)).snapshot;
    const second = (await snapshotOf(s, two.cookie)).snapshot;
    expect(first).toEqual(second);
    expect(first).toEqual(applyBatch(applyBatch(fresh, a), b));
    expect(Object.keys(first.learn.entries).length).toBeGreaterThan(0);
  });

  it('lose no increment when their syncs run at the same time', async () => {
    const s = setup();
    const { cookie } = await newUser();
    const responses = await Promise.all([
      post(s, cookie, request(1, { deviceId: A, counters: learned() })),
      post(s, cookie, request(1, { deviceId: B, counters: learned() })),
    ]);
    expect(responses.map((response) => response.status)).toEqual([200, 200]);
    expect((await snapshotOf(s, cookie)).snapshot.counters).toEqual(learned(2));
  });
});

describe('POST /api/sync: a lost version', () => {
  async function bump(userId: string): Promise<void> {
    await env.DB.prepare('UPDATE user_stats SET version = version + 1 WHERE user_id = ?')
      .bind(userId)
      .run();
  }

  it('is retried once without counting the batch twice', async () => {
    const { id, cookie } = await newUser();
    const counting = countingDb(env.DB, { beforeUpdate: () => bump(id) });
    const s = setup({ db: counting.db });
    const response = await post(
      s,
      cookie,
      request(1, { counters: learned(), results: [result(1)] }),
    );
    expect(response.status).toBe(200);
    // The other write took version 1, this batch version 2.
    expect(await json(response)).toEqual({ lastSeq: 1, version: 2 });
    expect((await snapshotOf(setup(), cookie)).snapshot.counters).toEqual(learned());
    expect(await count('results', id)).toBe(1);
  });

  it('is a 503 conflict with Retry-After when it is lost twice, and a resend then succeeds', async () => {
    const { id, cookie } = await newUser();
    const counting = countingDb(env.DB, { beforeEveryUpdate: () => bump(id) });
    const lost = await post(
      setup({ db: counting.db }),
      cookie,
      request(1, { counters: learned() }),
    );
    expect(lost.status).toBe(503);
    expect(lost.headers.get('Retry-After')).toBe('5');
    expect(await json(lost)).toEqual({ error: { code: 'conflict' } });
    expect((await snapshotOf(setup(), cookie)).snapshot.counters).toEqual(zeroCounters());

    const again = await post(setup(), cookie, request(1, { counters: learned() }));
    expect(again.status).toBe(200);
    expect((await snapshotOf(setup(), cookie)).snapshot.counters).toEqual(learned());
  });
});

describe('a year of learning', () => {
  const year: Year = generateYear({ seed: 5, keys: KANA_KEYS });
  const lastAt = (YEAR_FIRST_DAY + 364) * DAY;
  const yearSnapshot: Snapshot = {
    settings: null,
    kanaStats: year.kanaStats,
    counters: year.counters,
    learn: year.learn,
    typingRecords: year.typingRecords,
  };

  async function yearUser() {
    const user = await newUser(lastAt);
    await seedYear(env.DB, user.id, year);
    return user;
  }

  it('the stored row equals the snapshot of the batches applied by the shared function', async () => {
    const s = setup({ start: lastAt + DAY });
    const { cookie } = await yearUser();
    const before = await snapshotOf(s, cookie, DEVICE_ID);
    expect(before.lastSeq).toBe(LAST_SEQ);
    expect(before.snapshot.counters).toEqual(year.counters);

    let expected = yearSnapshot;
    for (const [index, kind] of (['learning', 'capped', 'results'] as const).entries()) {
      const batch = {
        ...generateBatch({ seed: 21 + index, keys: KANA_KEYS, kind }),
        seq: LAST_SEQ + 1 + index,
      };
      const response = await post(s, cookie, batch);
      expect(response.status).toBe(200);
      expect(await json(response)).toEqual({ lastSeq: LAST_SEQ + 1 + index, version: index + 1 });
      expected = applyBatch(expected, batch);
      const stored = await snapshotOf(s, cookie, DEVICE_ID);
      expect(stored.version).toBe(index + 1);
      expect(stored.snapshot).toEqual(expected);
    }
  });

  it('removes the device entries that are 90 days old and the bucket days out of the window', async () => {
    const s = setup({ start: lastAt + DAY });
    const { id, cookie } = await yearUser();
    const batch = generateBatch({ seed: 4, keys: KANA_KEYS, kind: 'learning' });
    expect((await post(s, cookie, batch)).status).toBe(200);

    const deviceSeq = await column(id, 'device_seq');
    expect(deviceSeq).toEqual({
      [DEVICE_ID]: { seq: LAST_SEQ + 1, at: lastAt + DAY },
      'device-b': year.deviceSeq['device-b'],
    });

    const buckets = await column(id, 'learn_buckets');
    const hiraganaDays =
      isObject(buckets) && isObject(buckets['hiragana']) ? buckets['hiragana'] : {};
    const days = Object.keys(hiraganaDays).map(Number);
    // The batch adds day `last + 2`: the window is [last + 2 - 365, last + 2].
    expect(Math.max(...days)).toBe(YEAR_FIRST_DAY + 366);
    expect(Math.min(...days)).toBe(YEAR_FIRST_DAY + 1);
    expect(days).toHaveLength(365);
    expect(await column(id, 'bucket_newest')).toEqual({
      hiragana: YEAR_FIRST_DAY + 366,
      katakana: YEAR_FIRST_DAY + 364,
    });
    expect(newestDays(year)).toEqual({
      hiragana: YEAR_FIRST_DAY + 364,
      katakana: YEAR_FIRST_DAY + 364,
    });
  });

  it('the three parts carry one version and equal the stored row', async () => {
    const s = setup({ start: lastAt + DAY });
    const { id, cookie } = await yearUser();
    await post(s, cookie, generateBatch({ seed: 4, keys: KANA_KEYS, kind: 'results' }));
    const { snapshot, version } = await snapshotOf(s, cookie, DEVICE_ID);
    expect(version).toBe(1);
    expect(snapshot.kanaStats).toEqual(await column(id, 'kana_stats'));
    expect(snapshot.counters).toEqual(await column(id, 'counters'));
    expect(snapshot.typingRecords).toEqual(await column(id, 'typing_records'));
    expect(snapshot.learn.recent).toEqual(await column(id, 'learn_recent'));
    expect(snapshot.learn.recallBuckets).toEqual(await column(id, 'learn_buckets'));
    const learn = await column(id, 'learn');
    expect({ ...snapshot.learn, recent: undefined, recallBuckets: undefined }).toEqual({
      ...(isObject(learn) ? learn : {}),
      recent: undefined,
      recallBuckets: undefined,
    });
    expect(await json(await get(s, cookie, `deviceId=${DEVICE_ID}`))).toEqual({
      lastSeq: LAST_SEQ + 1,
      version: 1,
    });
  });

  it('writes at most 2 rows for a learning sync and 6 for a finished test', async () => {
    const { id, cookie } = await yearUser();
    // Settings are updated in place: the first insert also writes the index entry of the key.
    await env.DB.prepare('INSERT INTO user_settings (user_id, json, updated_at) VALUES (?, ?, 0)')
      .bind(id, JSON.stringify(settings(0)))
      .run();
    const counting = countingDb(env.DB);
    const s = setup({ db: counting.db, start: lastAt + DAY });

    const learning = generateBatch({ seed: 6, keys: KANA_KEYS, kind: 'learning' });
    expect(
      (await post(s, cookie, { ...learning, delta: { ...learning.delta, settings: settings(1) } }))
        .status,
    ).toBe(200);
    expect(counting.log.rowsWritten).toBeLessThanOrEqual(2);
    expect(counting.log.rowsWritten).toBeGreaterThanOrEqual(1);

    counting.reset();
    const finished = request(LAST_SEQ + 2, {
      deviceId: DEVICE_ID,
      counters: { started: { typing: 1, learn: 0 }, finished: { typing: 1, learn: 0 } },
      settings: settings(2),
      results: [result(1, lastAt + 2 * DAY)],
    });
    expect((await post(s, cookie, finished)).status).toBe(200);
    expect(counting.log.rowsWritten).toBeLessThanOrEqual(6);
    expect(counting.log.rowsWritten).toBeGreaterThanOrEqual(4);
    expect(await count('results', id)).toBe(1);
  });

  it('uses at most 16 of the 50 statements for 50 results at the caps', async () => {
    const { cookie } = await yearUser();
    const counting = countingDb(env.DB);
    const s = setup({ db: counting.db, start: lastAt + DAY });
    const capped = generateBatch({ seed: 8, keys: KANA_KEYS, kind: 'capped' });
    const results = generateBatch({ seed: 8, keys: KANA_KEYS, kind: 'results' });
    const batch: SyncRequest = {
      ...capped,
      delta: { ...capped.delta, kanaStats: results.delta.kanaStats },
      results: results.results,
    };
    expect(batch.results).toHaveLength(50);
    expect((await post(s, cookie, batch)).status).toBe(200);
    expect(counting.log.statements).toBeLessThanOrEqual(16);
    // The session, 4 reads and 2 writes (the update and the results).
    expect(counting.log.statements).toBeGreaterThanOrEqual(7);
    // 50 results of one batch are inserted with the rows of their two indexes and the user.
    expect(counting.log.rowsWritten).toBeLessThanOrEqual(50 * 3 + 2);
  });
});

describe('SQLite json_patch against RFC 7396', () => {
  const year = generateYear({ seed: 9, keys: KANA_KEYS });
  const lastDay = YEAR_FIRST_DAY + 364;

  async function sqlPatch(target: unknown, patch: unknown): Promise<unknown> {
    const row = await env.DB.prepare('SELECT json_patch(?1, ?2) AS merged')
      .bind(JSON.stringify(target), JSON.stringify(patch))
      .first();
    const text = isObject(row) ? row['merged'] : null;
    if (typeof text !== 'string') throw new Error('json_patch returned no text');
    const parsed: unknown = JSON.parse(text);
    return parsed;
  }

  it.each([1, 2, 3])('gives the reference result for the patches of seed %i', async (seed) => {
    const batch = generateBatch({
      seed,
      keys: KANA_KEYS,
      kind: seed === 1 ? 'learning' : 'capped',
    });
    const learn = batch.delta.learn;

    const storedRecent = pickKeys(year.learn.recent, Object.keys(learn.recent));
    const recentPatch = patchRecent(storedRecent, learn.recent);
    expect(await sqlPatch(year.learn.recent, recentPatch)).toEqual(
      applyMergePatch(year.learn.recent, recentPatch),
    );

    const tracks = ['hiragana', 'katakana'] as const;
    const bucketPatch: Record<string, unknown> = {};
    for (const track of tracks) {
      const touched = Object.keys(learn.recallBuckets[track]);
      if (touched.length === 0) continue;
      const stored = Object.fromEntries(
        touched.flatMap((day) => {
          const buckets = year.learn.recallBuckets[track][day];
          return buckets === undefined ? [] : [[day, buckets]];
        }),
      );
      bucketPatch[track] = patchBuckets(stored, lastDay, learn.recallBuckets[track]).patch;
    }
    expect(await sqlPatch(year.learn.recallBuckets, bucketPatch)).toEqual(
      applyMergePatch(year.learn.recallBuckets, bucketPatch),
    );

    const { unlocked, entries, stats, activeDays } = year.learn;
    const rest = { unlocked, entries, stats, activeDays };
    const learnPatch = patchLearn(
      {
        unlocked: rest.unlocked,
        activeDays: rest.activeDays,
        entries: pickKeys(rest.entries, Object.keys(learn.entries)),
        stats: pickKeys(rest.stats, Object.keys(learn.stats)),
      },
      learn,
    );
    expect(await sqlPatch(rest, learnPatch)).toEqual(applyMergePatch(rest, learnPatch));
  });
});

describe('GET /api/sync', () => {
  it('rejects a missing device id and an unknown part', async () => {
    const s = setup();
    const { cookie } = await newUser();
    expect((await get(s, cookie, '')).status).toBe(400);
    expect((await get(s, cookie, 'deviceId=x')).status).toBe(400);
    expect((await get(s, cookie, `deviceId=${A}&part=all`)).status).toBe(400);
  });

  it('answers lastSeq and version without a part, and the empty parts for a new account', async () => {
    const s = setup();
    const { cookie } = await newUser();
    expect(await json(await get(s, cookie, `deviceId=${A}`))).toEqual({ lastSeq: 0, version: 0 });
    const { snapshot, version } = await snapshotOf(s, cookie);
    expect(version).toBe(0);
    expect(snapshot).toEqual(fresh);
  });
});
