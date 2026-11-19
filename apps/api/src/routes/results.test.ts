import { env } from 'cloudflare:workers';
import { isObject } from '@nekotype/shared/runtime';
import type { ResultsResponse, TestResult } from '@nekotype/shared/types';
import { describe, expect, it } from 'vitest';
import { createApp } from '../app';
import { signedInUser } from '../test-support';
import { testDeps } from '../test-deps';

const START = 1_700_000_000_000;

function result(id: string, endedAt: number): TestResult {
  return {
    id,
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
    kpm: 80,
    kanaAccuracy: 0.95,
    celebratedPersonalBest: false,
    contentVersion: 'c1',
    appVersion: 'a1',
  };
}

async function insert(userId: string, item: TestResult): Promise<void> {
  await env.DB.prepare(
    `INSERT INTO results (id, user_id, ended_at, content, script, strictness, config, kpm, kana_accuracy, json)
     VALUES (?, ?, ?, 'words', 'hiragana', 'learner', 'time:60', 80, 0.95, ?)`,
  )
    .bind(item.id, userId, item.endedAt, JSON.stringify(item))
    .run();
}

let users = 0;

async function setup() {
  users += 1;
  const userId = `history-user-${users}`;
  const { cookie } = await signedInUser(env.DB, userId, START);
  const { deps } = testDeps({}, START);
  const app = createApp(deps);
  const get = (query: string, headers: Record<string, string> = { Cookie: cookie }) =>
    app.request(`/api/results${query}`, { headers }, env);
  return { userId, cookie, get };
}

async function page(response: Response): Promise<ResultsResponse> {
  const body: unknown = await response.json();
  if (!isObject(body) || !Array.isArray(body['results'])) throw new Error('not a page');
  const next = body['next'];
  if (next !== null && typeof next !== 'string') throw new Error('bad cursor');
  const results: TestResult[] = [];
  for (const item of body['results']) {
    if (!isObject(item) || typeof item['id'] !== 'string') throw new Error('bad result');
    results.push(result(item['id'], Number(item['endedAt'])));
  }
  return { results, next };
}

describe('GET /api/results', () => {
  it('pages through 120 results with equal endedAt values, newest first, ties by id descending', async () => {
    const { userId, get } = await setup();
    // 120 results on 30 distinct times: every time holds four results.
    const all: TestResult[] = [];
    for (let index = 0; index < 120; index += 1) {
      all.push(result(`r-${String(index).padStart(3, '0')}`, START + Math.floor(index / 4) * 1000));
    }
    for (const item of all) await insert(userId, item);
    const expected = all
      .slice()
      .sort((a, b) => b.endedAt - a.endedAt || (a.id < b.id ? 1 : -1))
      .map((item) => item.id);

    const seen: string[] = [];
    let before: string | null = null;
    let requests = 0;
    do {
      const query: string = before === null ? '' : `?before=${encodeURIComponent(before)}`;
      const response = await get(query);
      expect(response.status).toBe(200);
      const { results, next } = await page(response);
      expect(results.length).toBeLessThanOrEqual(50);
      seen.push(...results.map((item) => item.id));
      before = next;
      requests += 1;
    } while (before !== null && requests < 10);

    expect(requests).toBe(3);
    expect(seen).toEqual(expected);
    expect(new Set(seen).size).toBe(120);
  });

  it('answers the last page with next null, also when it is exactly full', async () => {
    const { userId, get } = await setup();
    for (let index = 0; index < 50; index += 1) {
      await insert(userId, result(`f-${String(index).padStart(2, '0')}`, START + index));
    }
    const full = await page(await get(''));
    expect(full.results).toHaveLength(50);
    expect(full.next).toBeNull();
  });

  it('honours the limit and stays within 1 to 50', async () => {
    const { userId, get } = await setup();
    for (let index = 0; index < 5; index += 1) {
      await insert(userId, result(`l-${index}`, START + index));
    }
    const two = await page(await get('?limit=2'));
    expect(two.results.map((item) => item.id)).toEqual(['l-4', 'l-3']);
    expect(two.next).toBe(`${START + 3}:l-3`);
    for (const bad of ['0', '51', '-1', 'x', '1.5', '']) {
      expect((await get(`?limit=${bad}`)).status).toBe(400);
    }
    expect((await get('?limit=50')).status).toBe(200);
  });

  it('rejects a malformed cursor', async () => {
    const { get } = await setup();
    for (const bad of ['', 'abc', '123', ':id', '12:', 'x:id', '-5:id']) {
      expect((await get(`?before=${encodeURIComponent(bad)}`)).status).toBe(400);
    }
  });

  it('never returns another user’s results', async () => {
    const mine = await setup();
    const other = await setup();
    await insert(other.userId, result('theirs-1', START + 5));
    await insert(mine.userId, result('mine-1', START + 1));
    const response = await page(await mine.get(''));
    expect(response.results.map((item) => item.id)).toEqual(['mine-1']);
    // A cursor from the other user's history reveals nothing either.
    const after = await page(await mine.get(`?before=${START + 10}:zzz`));
    expect(after.results.map((item) => item.id)).toEqual(['mine-1']);
  });

  it('is 401 without a session', async () => {
    const { get } = await setup();
    expect((await get('', {})).status).toBe(401);
    expect((await get('', { Cookie: 'nt_session=nope' })).status).toBe(401);
  });
});
