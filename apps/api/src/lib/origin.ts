import { createMiddleware } from 'hono/factory';
import type { AppBindings } from '../env';
import { ApiError } from './errors';

const UNSAFE_METHODS = new Set(['POST', 'DELETE', 'PUT', 'PATCH']);

/** The origin the application is served from: `APP_ORIGIN`, else the request's own (D2). */
export function allowedOrigin(appOrigin: string | undefined, requestUrl: string): string {
  return appOrigin !== undefined && appOrigin !== '' ? appOrigin : new URL(requestUrl).origin;
}

/**
 * CSRF check of docs/spec/backend.md: every request that changes something carries an `Origin`
 * header equal to the application's origin. A missing header is rejected.
 */
export const originCheck = createMiddleware<AppBindings>(async (c, next) => {
  if (UNSAFE_METHODS.has(c.req.method)) {
    const origin = c.req.header('Origin');
    if (origin !== allowedOrigin(c.env.APP_ORIGIN, c.req.url)) throw new ApiError('bad_origin');
  }
  await next();
});
