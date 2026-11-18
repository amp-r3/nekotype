import { parseDeviceId, parseSyncRequest } from '@nekotype/shared/schemas';
import { Hono } from 'hono';
import { requireSession } from '../auth/session';
import { isSnapshotPart, readAck, readPart } from '../db/sync';
import type { AppBindings, AppDeps } from '../env';
import { ApiError } from '../lib/errors';
import { applySync } from '../sync/apply-batch';

/** Used when `SYNC_MIN_INTERVAL_MS` is missing or not a number (docs/spec/backend.md: one per 5 s). */
const DEFAULT_INTERVAL_MS = 5000;
const CONFLICT_RETRY_SECONDS = 5;

function intervalOf(value: string | undefined): number {
  const parsed = Number(value);
  return value !== undefined && Number.isFinite(parsed) && parsed >= 0
    ? parsed
    : DEFAULT_INTERVAL_MS;
}

const jsonHeaders = { 'content-type': 'application/json; charset=UTF-8' } as const;

/**
 * `POST` and `GET /api/sync` (docs/spec/backend.md, p5-plan.md D7). The order of checks: `Origin`
 * and the body size (middleware of the application), the session, the schema, then the `seq` rule
 * and the rate limit inside `applySync`.
 */
export function syncRoutes(deps: AppDeps) {
  const routes = new Hono<AppBindings>();

  routes.post('/', requireSession(deps.clock), async (c) => {
    let body: unknown;
    try {
      body = await c.req.json();
    } catch {
      throw new ApiError('invalid_body');
    }
    const request = parseSyncRequest(body);
    if (request === null) throw new ApiError('invalid_body');

    const outcome = await applySync(c.env.DB, c.var.userId, request, {
      now: deps.clock.now(),
      minIntervalMs: intervalOf(c.env.SYNC_MIN_INTERVAL_MS),
    });
    switch (outcome.kind) {
      case 'ok':
        return c.json(outcome.response);
      case 'gap':
        throw new ApiError('seq_gap', outcome.lastSeq);
      case 'limited':
        c.header('Retry-After', String(outcome.retryAfterSeconds));
        throw new ApiError('rate_limited');
      case 'conflict':
        c.header('Retry-After', String(CONFLICT_RETRY_SECONDS));
        throw new ApiError('conflict');
    }
  });

  routes.get('/', requireSession(deps.clock), async (c) => {
    const query = c.req.query();
    const deviceId = parseDeviceId(query['deviceId']);
    if (deviceId === null) throw new ApiError('invalid_body');
    const part = query['part'];
    if (part === undefined) {
      const ack = await readAck(c.env.DB, c.var.userId, deviceId);
      if (ack === null) throw new ApiError('unavailable');
      return c.json(ack);
    }
    if (!isSnapshotPart(part)) throw new ApiError('invalid_body');
    const text = await readPart(c.env.DB, c.var.userId, deviceId, part);
    if (text === null) throw new ApiError('unavailable');
    return c.body(text, 200, jsonHeaders);
  });

  return routes;
}
