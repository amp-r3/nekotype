import { Hono } from 'hono';
import { requireSession } from '../auth/session';
import { findUserProfile } from '../db/users';
import type { AppBindings, AppDeps } from '../env';
import { ApiError } from '../lib/errors';

/** `GET /api/me`: the profile of the session's user, or `401` (docs/spec/backend.md). */
export function meRoutes(deps: AppDeps) {
  const routes = new Hono<AppBindings>();

  routes.get('/', requireSession(deps.clock), async (c) => {
    const profile = await findUserProfile(c.env.DB, c.var.userId);
    if (profile === null) throw new ApiError('unauthenticated');
    return c.json(profile);
  });

  return routes;
}
