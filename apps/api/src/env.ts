import type { Clock } from '@nekotype/shared/types';

/** The bindings and variables of the Pages project (wrangler.toml at the repository root, D4). */
export interface Env {
  DB: D1Database;
  /** `development`, `preview`, `production`; `test` in the API tests. */
  ENVIRONMENT: string;
  /** The origin the application is served from; unset on previews, where the request's is used. */
  APP_ORIGIN?: string;
  /** Milliseconds between two applied syncs of one user; a string, as every variable is. */
  SYNC_MIN_INTERVAL_MS: string;
}

/** What the application needs from outside, so a test can pass fakes (D2). */
export interface AppDeps {
  clock: Clock;
  randomBytes: (n: number) => Uint8Array;
}

export type AppBindings = { Bindings: Env; Variables: { userId: string } };
