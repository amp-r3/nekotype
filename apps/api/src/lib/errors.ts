import type { ApiErrorCode } from '@nekotype/shared/types';
import type { ContentfulStatusCode } from 'hono/utils/http-status';

export type { ApiErrorCode };

export const ERROR_STATUS: Readonly<Record<ApiErrorCode, ContentfulStatusCode>> = {
  invalid_body: 400,
  unauthenticated: 401,
  bad_origin: 403,
  turnstile_failed: 403,
  not_found: 404,
  seq_gap: 409,
  too_large: 413,
  rate_limited: 429,
  internal: 500,
  conflict: 503,
  unavailable: 503,
};

/** Thrown by a route to answer with the error body of the table; `onError` turns it into a response. */
export class ApiError extends Error {
  readonly code: ApiErrorCode;
  readonly lastSeq: number | undefined;

  constructor(code: ApiErrorCode, lastSeq?: number) {
    super(code);
    this.code = code;
    this.lastSeq = lastSeq;
  }
}

export interface ErrorBody {
  error: { code: ApiErrorCode; lastSeq?: number };
}

export function errorBody(code: ApiErrorCode, lastSeq?: number): ErrorBody {
  return { error: lastSeq === undefined ? { code } : { code, lastSeq } };
}

/** A failure of D1 itself: its errors say so in the message ("D1_ERROR: …", "D1_…"). */
export function isD1Failure(error: unknown): boolean {
  return error instanceof Error && /\bD1_[A-Z_]+/.test(`${error.message} ${String(error.cause)}`);
}
