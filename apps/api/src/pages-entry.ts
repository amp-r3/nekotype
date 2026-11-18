import { arcticProviders } from './auth/providers';
import { createApp } from './app';
import type { Env } from './env';

// The application with its real dependencies. `functions/api/[[route]].ts` re-exports `onRequest`.
const app = createApp({
  clock: { now: () => Date.now() },
  randomBytes: (n) => crypto.getRandomValues(new Uint8Array(n)),
  oauth: arcticProviders,
});

// What `handle` of `hono/cloudflare-pages` does, without it: that adapter is deprecated and goes in
// Hono 5.
export const onRequest: PagesFunction<Env> = (context) =>
  app.fetch(context.request, context.env, {
    waitUntil: (promise) => {
      context.waitUntil(promise);
    },
    passThroughOnException: () => {
      context.passThroughOnException();
    },
    props: {},
  });
