import { describe, expect, it } from 'vitest';
import { fetchHistoryPage, historyCursor } from './history';

const reply =
  (body: unknown, status = 200) =>
  () =>
    Promise.resolve(new Response(JSON.stringify(body), { status }));

describe('fetchHistoryPage', () => {
  it('asks for the newest page without a cursor and escapes the cursor otherwise', async () => {
    const urls: string[] = [];
    const record = (input: string) => {
      urls.push(input);
      return Promise.resolve(new Response(JSON.stringify({ results: [], next: null })));
    };
    await fetchHistoryPage(null, record);
    await fetchHistoryPage('1700000000000:a b', record);
    expect(urls).toEqual(['/api/results', '/api/results?before=1700000000000%3Aa%20b']);
  });

  it('returns the page', async () => {
    expect(await fetchHistoryPage(null, reply({ results: [], next: '5:x' }))).toEqual({
      kind: 'ok',
      results: [],
      next: '5:x',
    });
  });

  it('fails on an error status, a body that is not a page and no network', async () => {
    expect(
      await fetchHistoryPage(null, reply({ error: { code: 'unauthenticated' } }, 401)),
    ).toEqual({
      kind: 'failed',
    });
    expect(await fetchHistoryPage(null, reply({ results: 'x' }))).toEqual({ kind: 'failed' });
    expect(await fetchHistoryPage(null, () => Promise.reject(new Error('offline')))).toEqual({
      kind: 'failed',
    });
  });

  it('writes the cursor as endedAt:id', () => {
    expect(historyCursor({ endedAt: 1700000000000, id: 'abc' })).toBe('1700000000000:abc');
  });
});
