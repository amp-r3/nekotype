import { defineConfig } from 'vite';
import preact from '@preact/preset-vite';
import tailwindcss from '@tailwindcss/vite';
import { fileURLToPath, URL } from 'node:url';

export default defineConfig({
  base: process.env.VITE_BASE ?? '/',
  plugins: [tailwindcss(), preact()],
  define: {
    // The test build (`pnpm run build:probe`) carries the latency probe; the production build does
    // not: the constant is false, and the probe is dead code the minifier removes.
    __LATENCY_PROBE__: JSON.stringify(process.env['VITE_LATENCY_PROBE'] === 'true'),
  },
  resolve: {
    alias: {
      '@': fileURLToPath(new URL('./src', import.meta.url)),
    },
  },
  build: {
    target: 'es2022',
    manifest: true,
    // Every target browser but Safari 16 supports `modulepreload`; there the chunks still load,
    // only without the parallel prefetch. The polyfill would cost every visitor ~0.3 KB.
    modulePreload: { polyfill: false },
    rolldownOptions: {
      output: {
        codeSplitting: {
          // Everything the entry loads statically is one chunk: one gzip stream and no export
          // lists between chunks (about 1.8 KB less than the default split). A barrel that holds
          // code of its own keeps every module it re-exports in this chunk, so barrels stay
          // re-exports only (packages/engine/src/data/index.ts).
          groups: [{ name: 'index', tags: ['$initial'] }],
        },
      },
    },
  },
});
