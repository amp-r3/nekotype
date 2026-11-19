import { parseReportRequest } from '@nekotype/shared/schemas';
import { Hono } from 'hono';
import { base64url, optionalUserId } from '../auth/session';
import { insertReport } from '../db/reports';
import type { AppBindings, AppDeps } from '../env';
import { limitBody } from '../lib/body';
import { ApiError } from '../lib/errors';
import { isTestSecret } from '../lib/turnstile';

/** One report and at most 8 KB per request (docs/spec/backend.md). */
export const MAX_REPORT_BYTES = 8 * 1024;

/**
 * `POST /api/reports` (docs/spec/backend.md, p5-plan.md D21): open to guests; a valid session only
 * sets `user_id`. The order: `Origin` and the body size, the secret, the schema, the Turnstile
 * token. Without the secret, or with one of Cloudflare's test secrets in production, the endpoint
 * is closed (`503`) rather than open to anyone.
 */
export function reportsRoutes(deps: AppDeps) {
  const routes = new Hono<AppBindings>();

  routes.post('/', limitBody(MAX_REPORT_BYTES), async (c) => {
    const secret = c.env.TURNSTILE_SECRET_KEY;
    if (secret === undefined || secret === '') throw new ApiError('unavailable');
    if (c.env.ENVIRONMENT === 'production' && isTestSecret(secret)) {
      throw new ApiError('unavailable');
    }

    let body: unknown;
    try {
      body = await c.req.json();
    } catch {
      throw new ApiError('invalid_body');
    }
    const report = parseReportRequest(body);
    if (report === null) throw new ApiError('invalid_body');

    let passed: boolean;
    try {
      passed = await deps.verifyTurnstile(
        report.turnstileToken,
        c.req.header('CF-Connecting-IP') ?? null,
        secret,
      );
    } catch {
      throw new ApiError('unavailable');
    }
    if (!passed) throw new ApiError('turnstile_failed');

    const userId = await optionalUserId(c, deps.clock);
    await insertReport(c.env.DB, base64url(deps.randomBytes(16)), userId, report, deps.clock.now());
    return c.body(null, 204);
  });

  return routes;
}
