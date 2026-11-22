import { defineConfig, devices } from '@playwright/test';

// The latency test needs a production-like build with the probe in it, served by `vite preview`: a
// development server is not what a user gets. It has its own configuration and port, so the other
// e2e files never build the probe (docs/spec/quality.md). Chromium only: the CPU throttling is a
// DevTools protocol feature.
const port = Number(process.env['E2E_LATENCY_PORT'] ?? 5373);
const baseURL = `http://localhost:${port}`;

export default defineConfig({
  testDir: './e2e',
  testMatch: /(latency|model-cost)\.spec\.ts/,
  timeout: 180000,
  expect: {
    timeout: 5000,
  },
  fullyParallel: false,
  reporter: 'list',
  use: {
    baseURL,
    trace: 'on-first-retry',
  },
  projects: [
    {
      name: 'latency',
      use: { ...devices['Desktop Chrome'] },
    },
  ],
  webServer: {
    command: `pnpm run build:probe && pnpm exec vite preview --outDir dist-probe --port ${port} --strictPort`,
    url: baseURL,
    reuseExistingServer: false,
    timeout: 120000,
  },
});
