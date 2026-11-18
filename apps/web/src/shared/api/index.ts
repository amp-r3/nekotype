import { isObject } from '@nekotype/shared/runtime';

/** The outcome of a request to the API: the unchecked body, the error of backend.md, or no answer. */
export type ApiResult =
  | { readonly kind: 'ok'; readonly status: number; readonly body: unknown }
  | {
      readonly kind: 'error';
      readonly status: number;
      /** `error.code` of the body, when it has one. */
      readonly code: string | null;
      /** `error.lastSeq` of a `409`. */
      readonly lastSeq: number | null;
      /** `Retry-After` in milliseconds, when the response has one. */
      readonly retryAfterMs: number | null;
    }
  | { readonly kind: 'network' };

export type ApiRequest = {
  readonly method?: 'GET' | 'POST' | 'DELETE';
  /** A JSON text, serialized by the caller, which knows its size. */
  readonly body?: string;
  /** For a request sent while the page is hidden (a body of at most 60 KB). */
  readonly keepalive?: boolean;
};

export type FetchLike = (input: string, init: RequestInit) => Promise<Response>;

async function json(response: Response): Promise<unknown> {
  try {
    const value: unknown = await response.json();
    return value;
  } catch {
    return null;
  }
}

function retryAfterMs(response: Response): number | null {
  const seconds = Number(response.headers.get('Retry-After'));
  return Number.isFinite(seconds) && seconds > 0 ? Math.ceil(seconds) * 1000 : null;
}

/**
 * A request to `/api`: JSON in, JSON out. It never throws: a failure of the network is a result.
 * `fetch` is injected so that tests need no server.
 */
export async function apiFetch(
  path: string,
  request: ApiRequest = {},
  fetchFn: FetchLike = (input, init) => fetch(input, init),
): Promise<ApiResult> {
  let response: Response;
  try {
    response = await fetchFn(path, {
      method: request.method ?? 'GET',
      ...(request.body === undefined
        ? {}
        : { body: request.body, headers: { 'Content-Type': 'application/json' } }),
      ...(request.keepalive === true ? { keepalive: true } : {}),
    });
  } catch {
    return { kind: 'network' };
  }
  const body = response.status === 204 ? null : await json(response);
  if (response.ok) return { kind: 'ok', status: response.status, body };
  const error = isObject(body) ? body['error'] : null;
  const lastSeq = isObject(error) ? error['lastSeq'] : null;
  const code = isObject(error) ? error['code'] : null;
  return {
    kind: 'error',
    status: response.status,
    code: typeof code === 'string' ? code : null,
    lastSeq: typeof lastSeq === 'number' ? lastSeq : null,
    retryAfterMs: retryAfterMs(response),
  };
}
