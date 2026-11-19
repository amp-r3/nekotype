import { defineConfig, devices } from '@playwright/test';

// The sync tests (p5-plan.md, D9) run against the production bundle served by `wrangler pages dev`
// together with the real API code, a local D1 and a fake OAuth provider: `e2e/sync-server/` builds
// and starts it. Chromium only; two devices are covered below the browser (ADR 052). A test
// signs in as the user named in the cookie `e2e_user`; every test uses a name of its own, because
// the database lives for the whole run.
const port = Number(process.env['E2E_SYNC_PORT'] ?? 5274);
const baseURL = `http://localhost:${String(port)}`;

export default defineConfig({
  testDir: './e2e/sync',
  timeout: 60000,
  expect: {
    timeout: 8000,
  },
  fullyParallel: false,
  workers: 1,
  reporter: 'list',
  use: {
    baseURL,
    trace: 'on-first-retry',
  },
  projects: [{ name: 'chromium', use: { ...devices['Desktop Chrome'] } }],
  webServer: {
    command: 'node e2e/sync-server/start.mjs',
    url: baseURL,
    reuseExistingServer: false,
    timeout: 180000,
    env: { E2E_SYNC_PORT: String(port) },
  },
});
