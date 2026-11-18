import { describe, expect, it } from 'vitest';
import { apiFetch } from './index';

const reply = (response: Response | Error) => (): Promise<Response> =>
  response instanceof Error ? Promise.reject(response) : Promise.resolve(response);

describe('apiFetch', () => {
  it('returns the JSON body of a success', async () => {
    const result = await apiFetch('/api/x', {}, reply(Response.json({ a: 1 })));
    expect(result).toEqual({ kind: 'ok', status: 200, body: { a: 1 } });
  });

  it('sends a JSON body with its content type, and keepalive when asked', async () => {
    const seen: RequestInit[] = [];
    await apiFetch('/api/x', { method: 'POST', body: '{"a":1}', keepalive: true }, (_url, init) => {
      seen.push(init);
      return Promise.resolve(new Response(null, { status: 204 }));
    });
    expect(seen[0]).toMatchObject({
      method: 'POST',
      body: '{"a":1}',
      keepalive: true,
      headers: { 'Content-Type': 'application/json' },
    });
  });

  it('answers a 204 with a null body', async () => {
    const result = await apiFetch('/api/x', {}, reply(new Response(null, { status: 204 })));
    expect(result).toEqual({ kind: 'ok', status: 204, body: null });
  });

  it('reads the error code, lastSeq and Retry-After', async () => {
    const response = Response.json(
      { error: { code: 'seq_gap', lastSeq: 4 } },
      { status: 409, headers: { 'Retry-After': '5' } },
    );
    expect(await apiFetch('/api/x', {}, reply(response))).toEqual({
      kind: 'error',
      status: 409,
      code: 'seq_gap',
      lastSeq: 4,
      retryAfterMs: 5000,
    });
  });

  it('survives an error without a JSON body', async () => {
    const result = await apiFetch('/api/x', {}, reply(new Response('boom', { status: 502 })));
    expect(result).toEqual({
      kind: 'error',
      status: 502,
      code: null,
      lastSeq: null,
      retryAfterMs: null,
    });
  });

  it('turns a failed fetch into a network result', async () => {
    expect(await apiFetch('/api/x', {}, reply(new TypeError('offline')))).toEqual({
      kind: 'network',
    });
  });
});
