import { Hono } from 'hono';
import type { AppBindings, AppDeps } from './env';
import { authRoutes } from './routes/auth';
import { meRoutes } from './routes/me';
import { limitBody } from './lib/body';
import { ApiError, ERROR_STATUS, errorBody, isD1Failure } from './lib/errors';
import { originCheck } from './lib/origin';

/**
 * The application behind `/api/*`: middleware and route mounting, with the outside world injected
 * (D2). The pull requests that follow mount their routes here.
 */
export function createApp(deps: AppDeps) {
  const app = new Hono<AppBindings>().basePath('/api');

  app.onError((error, c) => {
    if (error instanceof ApiError) {
      return c.json(errorBody(error.code, error.lastSeq), ERROR_STATUS[error.code]);
    }
    if (isD1Failure(error)) return c.json(errorBody('unavailable'), 503);
    return c.json(errorBody('internal'), 500);
  });
  app.notFound((c) => c.json(errorBody('not_found'), 404));

  app.use(originCheck);
  app.use(limitBody());

  app.route('/auth', authRoutes(deps));
  app.route('/me', meRoutes(deps));

  return app;
}
