import { defineConfig } from 'vitest/config';

export default defineConfig({
  test: {
    environment: 'node',
    include: ['src/**/*.test.ts'],
    coverage: {
      provider: 'v8',
      include: ['src/**/*.ts'],
      exclude: ['src/**/*.test.ts'],
      reporter: ['text-summary'],
      // ADR 101 (D1 of the P7 plan): the model is pure logic and tested as the engine is.
      thresholds: { statements: 95, branches: 90, functions: 95, lines: 95 },
    },
  },
});
