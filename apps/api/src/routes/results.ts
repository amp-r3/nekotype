import { Hono } from 'hono';
import type { ResultsResponse } from '@nekotype/shared/types';
import { requireSession } from '../auth/session';
import { cursorOf, parseCursor, readResults } from '../db/results';
import type { ResultsCursor } from '../db/results';
import type { AppBindings, AppDeps } from '../env';
import { ApiError } from '../lib/errors';

/** At most this many results per request (docs/spec/backend.md); also the default. */
export const MAX_RESULTS_PAGE = 50;

function limitOf(text: string | undefined): number {
  if (text === undefined) return MAX_RESULTS_PAGE;
  if (!/^[1-9]\d{0,2}$/.test(text)) throw new ApiError('invalid_body');
  const limit = Number(text);
  if (limit > MAX_RESULTS_PAGE) throw new ApiError('invalid_body');
  return limit;
}

/**
 * `GET /api/results?before=&limit=`: the user's test history, newest first, ties by id, descending
 * (docs/spec/backend.md). `before` is the cursor `<endedAt>:<id>` of the last result already held;
 * the response's `next` is the cursor for the following page, `null` on the last one.
 */
export function resultsRoutes(deps: AppDeps) {
  const routes = new Hono<AppBindings>();

  routes.get('/', requireSession(deps.clock), async (c) => {
    const query = c.req.query();
    const limit = limitOf(query['limit']);
    let before: ResultsCursor | null = null;
    if (query['before'] !== undefined) {
      before = parseCursor(query['before']);
      if (before === null) throw new ApiError('invalid_body');
    }
    const page = await readResults(c.env.DB, c.var.userId, before, limit);
    const last = page.results.at(-1);
    const body: ResultsResponse = {
      results: page.results,
      next: page.more && last !== undefined ? cursorOf(last) : null,
    };
    return c.json(body);
  });

  return routes;
}
