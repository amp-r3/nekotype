import { isObject, SYNC_FORMAT_V2, SYNC_FORMAT_VERSION } from '@nekotype/shared/runtime';
import {
  parseAfter,
  parseDeviceId,
  parseSyncRequest,
  parseSyncRequestV2,
} from '@nekotype/shared/schemas';
import { Hono } from 'hono';
import { requireSession } from '../auth/session';
import { readPull } from '../db/batches';
import { isSnapshotPart, readAck, readPart } from '../db/sync';
import type { AppBindings, AppDeps } from '../env';
import { ApiError } from '../lib/errors';
import { applyLog } from '../sync/apply-log';
import type { LogOutcome } from '../sync/apply-log';
import { applySync } from '../sync/apply-batch';
import type { SyncOutcome } from '../sync/apply-batch';

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
 * `POST` and `GET /api/sync` (docs/spec/backend.md, p5-plan.md D7, p7-plan.md D12): formats 2 and 3. The order of checks: `Origin`
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
    // The format is the `v` of the body: 3 is the log, 2 the deltas until PR 13 of P7 (D15).
    const format = isObject(body) ? body['v'] : undefined;
    const now = deps.clock.now();
    const minIntervalMs = intervalOf(c.env.SYNC_MIN_INTERVAL_MS);

    let outcome: LogOutcome | SyncOutcome;
    if (format === SYNC_FORMAT_VERSION) {
      const request = parseSyncRequest(body);
      if (request === null) throw new ApiError('invalid_body');
      outcome = await applyLog(c.env.DB, c.var.userId, request, { now, minIntervalMs });
    } else if (format === SYNC_FORMAT_V2) {
      const request = parseSyncRequestV2(body);
      if (request === null) throw new ApiError('invalid_body');
      outcome = await applySync(c.env.DB, c.var.userId, request, { now, minIntervalMs });
    } else {
      throw new ApiError('invalid_body');
    }
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
    const afterText = query['after'];
    if (afterText !== undefined) {
      // Format 3: the rows of other devices after `after`.
      const after = parseAfter(afterText);
      if (after === null || part !== undefined) throw new ApiError('invalid_body');
      const text = await readPull(c.env.DB, c.var.userId, deviceId, after);
      return c.body(text, 200, jsonHeaders);
    }
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
