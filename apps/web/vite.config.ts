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
  },
});
