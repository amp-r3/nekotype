import { Hono } from 'hono';
import { deleteCookie, getCookie, setCookie } from 'hono/cookie';
import type { Context } from 'hono';
import { base64url, endSession, isSecureOrigin, startSession } from '../auth/session';
import { findOrCreateUser } from '../auth/users';
import {
  type AppBindings,
  type AppDeps,
  type OAuthCredentials,
  type OAuthProviderName,
  isOAuthProviderName,
} from '../env';
import { ApiError } from '../lib/errors';
import { allowedOrigin } from '../lib/origin';

const OAUTH_COOKIE = 'nt_oauth';
const OAUTH_COOKIE_PATH = '/api/auth';
const OAUTH_COOKIE_MAX_AGE_S = 600;

type AuthContext = Context<AppBindings>;

function oauthCookieOptions(c: AuthContext) {
  return {
    httpOnly: true,
    secure: isSecureOrigin(c.env.APP_ORIGIN),
    sameSite: 'Lax',
    path: OAUTH_COOKIE_PATH,
  } as const;
}

function credentialsOf(c: AuthContext, provider: OAuthProviderName): OAuthCredentials {
  const { env } = c;
  const clientId = provider === 'google' ? env.GOOGLE_CLIENT_ID : env.GITHUB_CLIENT_ID;
  const clientSecret = provider === 'google' ? env.GOOGLE_CLIENT_SECRET : env.GITHUB_CLIENT_SECRET;
  // A deployment without its secrets cannot sign anyone in; it is not the visitor's mistake.
  if (
    clientId === undefined ||
    clientId === '' ||
    clientSecret === undefined ||
    clientSecret === ''
  ) {
    throw new ApiError('unavailable');
  }
  return { clientId, clientSecret };
}

function providerOf(c: AuthContext): OAuthProviderName {
  const name = c.req.param('provider') ?? '';
  if (!isOAuthProviderName(name)) throw new ApiError('not_found');
  return name;
}

function redirectUriOf(c: AuthContext, provider: OAuthProviderName): string {
  return `${allowedOrigin(c.env.APP_ORIGIN, c.req.url)}/api/auth/${provider}/callback`;
}

function backToApp(c: AuthContext, authError?: 'denied' | 'failed'): Response {
  deleteCookie(c, OAUTH_COOKIE, oauthCookieOptions(c));
  return c.redirect(authError === undefined ? '/' : `/?auth_error=${authError}`, 302);
}

/** `GET /api/auth/:provider`, its callback and `POST /api/auth/logout` (docs/spec/backend.md, D6). */
export function authRoutes(deps: AppDeps) {
  const routes = new Hono<AppBindings>();

  // A preview cannot sign in (Google accepts no wildcard redirect URI): its auth routes do not
  // exist (S3).
  routes.use(async (c, next) => {
    if (c.env.ENVIRONMENT === 'preview') throw new ApiError('not_found');
    await next();
  });

  routes.post('/logout', async (c) => {
    await endSession(c);
    return c.body(null, 204);
  });

  routes.get('/:provider', (c) => {
    const provider = providerOf(c);
    const credentials = credentialsOf(c, provider);
    const state = base64url(deps.randomBytes(32));
    const codeVerifier = base64url(deps.randomBytes(32));
    const url = deps.oauth[provider].authorizationUrl(
      credentials,
      state,
      codeVerifier,
      redirectUriOf(c, provider),
    );
    setCookie(c, OAUTH_COOKIE, `${state}.${codeVerifier}`, {
      ...oauthCookieOptions(c),
      maxAge: OAUTH_COOKIE_MAX_AGE_S,
    });
    return c.redirect(url.toString(), 302);
  });

  routes.get('/:provider/callback', async (c) => {
    const provider = providerOf(c);
    const credentials = credentialsOf(c, provider);
    const query = c.req.query();
    if (query['error'] === 'access_denied') return backToApp(c, 'denied');

    const [state, codeVerifier] = (getCookie(c, OAUTH_COOKIE) ?? '').split('.');
    const code = query['code'];
    if (
      state === undefined ||
      state === '' ||
      codeVerifier === undefined ||
      query['state'] !== state ||
      code === undefined ||
      code === ''
    ) {
      return backToApp(c, 'failed');
    }

    let profile;
    try {
      profile = await deps.oauth[provider].profile(
        credentials,
        code,
        codeVerifier,
        redirectUriOf(c, provider),
      );
    } catch {
      return backToApp(c, 'failed');
    }

    const now = deps.clock.now();
    const userId = await findOrCreateUser(c.env.DB, provider, profile, now);
    await startSession(c, userId, now, deps.randomBytes);
    return backToApp(c);
  });

  return routes;
}
