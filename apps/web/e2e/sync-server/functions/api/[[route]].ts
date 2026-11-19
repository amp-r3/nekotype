import { createApp } from '../../../../../api/src/app';
import type { Env, OAuthProvider, OAuthProviders } from '../../../../../api/src/env';

// The API of the sync e2e tests: the real application (`createApp`: sessions, users, `/api/sync`)
// with a fake OAuth provider in place of Google and GitHub, and one route that only this entry
// has. A test sets the cookie `e2e_user` and presses the real sign-in button: the provider "sends"
// the browser to `/api/test/authorize`, which answers with the real callback and the cookie's value
// as the code, and `profile` turns the code into a verified address. The deployed bundle never
// includes this file (p5-plan.md, D9; a test in `apps/api` keeps it that way).

const AUTHORIZE_PATH = '/api/test/authorize';
const USER_COOKIE = 'e2e_user';

const fakeProvider: OAuthProvider = {
  authorizationUrl: (_credentials, state, _codeVerifier, redirectUri) => {
    const url = new URL(AUTHORIZE_PATH, redirectUri);
    url.searchParams.set('state', state);
    url.searchParams.set('redirect_uri', redirectUri);
    return url;
  },
  profile: (_credentials, code) =>
    Promise.resolve({
      providerUserId: code,
      email: `${code}@example.test`,
      displayName: code,
      avatarUrl: null,
    }),
};

const oauth: OAuthProviders = { google: fakeProvider, github: fakeProvider };

const app = createApp({
  clock: { now: () => Date.now() },
  randomBytes: (n) => crypto.getRandomValues(new Uint8Array(n)),
  oauth,
  // The e2e never sends a report (Turnstile needs Cloudflare's network, p5-plan.md).
  verifyTurnstile: () => Promise.resolve(false),
});

function cookieValue(header: string | null, name: string): string | null {
  for (const part of (header ?? '').split(';')) {
    const [key, ...rest] = part.trim().split('=');
    if (key === name) return rest.join('=');
  }
  return null;
}

function authorize(request: Request): Response {
  const url = new URL(request.url);
  const redirectUri = url.searchParams.get('redirect_uri') ?? '';
  const callback = new URL(redirectUri);
  const user = cookieValue(request.headers.get('Cookie'), USER_COOKIE);
  if (user === null || user === '') {
    callback.searchParams.set('error', 'access_denied');
  } else {
    callback.searchParams.set('code', user);
    callback.searchParams.set('state', url.searchParams.get('state') ?? '');
  }
  return Response.redirect(callback.toString(), 302);
}

export const onRequest: PagesFunction<Env> = (context) => {
  if (new URL(context.request.url).pathname === AUTHORIZE_PATH) {
    return authorize(context.request);
  }
  return app.fetch(context.request, context.env, {
    waitUntil: (promise) => {
      context.waitUntil(promise);
    },
    passThroughOnException: () => {
      context.passThroughOnException();
    },
    props: {},
  });
};
