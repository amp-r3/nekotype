import { Hono } from 'hono';
import { endSession, requireSession } from '../auth/session';
import { deleteUser, findUserProfile } from '../db/users';
import type { AppBindings, AppDeps } from '../env';
import { ApiError } from '../lib/errors';

/** `GET /api/me` and `DELETE /api/me` (docs/spec/backend.md). */
export function meRoutes(deps: AppDeps) {
  const routes = new Hono<AppBindings>();

  routes.get('/', requireSession(deps.clock), async (c) => {
    const profile = await findUserProfile(c.env.DB, c.var.userId);
    if (profile === null) throw new ApiError('unauthenticated');
    return c.json(profile);
  });

  // The account and everything of it; the session row goes with the cascade, the cookie here.
  routes.delete('/', requireSession(deps.clock), async (c) => {
    await deleteUser(c.env.DB, c.var.userId);
    await endSession(c);
    return c.body(null, 204);
  });

  return routes;
}
