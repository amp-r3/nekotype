import type { D1Migration } from '@cloudflare/vitest-plugin';
import type { Env as AppEnv } from './env';

// The type of `env` from `cloudflare:workers` in the tests: the bindings of wrangler.test.toml and
// the migrations that vitest.config.ts passes in.
declare global {
  namespace Cloudflare {
    interface Env extends AppEnv {
      TEST_MIGRATIONS: D1Migration[];
    }
  }
}
