import { defineConfig, devices } from '@playwright/test';

// WebKit in mobile emulation runs next to Chromium (docs/spec/quality.md). It needs its own
// system libraries (`playwright install --with-deps chromium webkit`); a machine without them
// can set E2E_SKIP_WEBKIT=1. CI always runs it.
const skipWebkit = process.env['E2E_SKIP_WEBKIT'] === '1' && process.env['CI'] === undefined;

// The tests run against the production bundle: `vite build` into `dist-e2e` and `vite preview` on a
// port of its own, not the development one (5173), because a development server is not what a
// user gets (docs/spec/quality.md). They never reuse a server that is already there: one kept
// running while you work can serve an older build of the code, and the tests would then pass or
// fail because of it, not because of the code under test. If the port is taken the run stops and
// says so. The latency test has its own configuration (playwright.latency.config.ts), so running
// one of these files does not build the probe.
const port = Number(process.env['E2E_PORT'] ?? 5273);
const baseURL = `http://localhost:${port}`;

export default defineConfig({
  testDir: './e2e',
  // The sync tests have a configuration and a server of their own (playwright.sync.config.ts).
  testIgnore: [
    /latency\.spec\.ts/,
    /model-cost\.spec\.ts/,
    /home-cost\.spec\.ts/,
    /[\\/]sync[\\/]/,
  ],
  timeout: 30000,
  expect: {
    timeout: 5000,
  },
  fullyParallel: false,
  reporter: 'list',
  use: {
    baseURL,
    trace: 'retain-on-failure',
  },
  projects: [
    {
      name: 'chromium',
      use: { ...devices['Desktop Chrome'] },
    },
    ...(skipWebkit
      ? []
      : [
          {
            name: 'webkit-mobile',
            use: { ...devices['iPhone 13'] },
            // Only what depends on the phone or on the WebKit engine: focus after a tap, layouts,
            // the number of lines, a full test. Everything else runs on Chromium (ADR 053).
            grep: /@mobile/,
          },
        ]),
  ],
  webServer: {
    command: `pnpm exec vite build --outDir dist-e2e --emptyOutDir && pnpm exec vite preview --outDir dist-e2e --port ${port} --strictPort`,
    url: baseURL,
    reuseExistingServer: false,
    timeout: 120000,
  },
});
