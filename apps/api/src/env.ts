import type { Clock } from '@nekotype/shared/types';

/** The bindings and variables of the Pages project (wrangler.toml at the repository root, D4). */
export interface Env {
  DB: D1Database;
  /** `development`, `preview`, `production`; `test` in the API tests. */
  ENVIRONMENT: string;
  /** The origin the application is served from; unset on previews, where the request's is used. */
  APP_ORIGIN?: string;
  /** Milliseconds between two applied syncs of one user; a string, as every variable is. */
  SYNC_MIN_INTERVAL_MS: string;
  // Secrets (`.dev.vars` locally, `wrangler pages secret put` on Cloudflare); unset when missing.
  GOOGLE_CLIENT_ID?: string;
  GOOGLE_CLIENT_SECRET?: string;
  GITHUB_CLIENT_ID?: string;
  GITHUB_CLIENT_SECRET?: string;
}

export const OAUTH_PROVIDER_NAMES = ['google', 'github'] as const;
export type OAuthProviderName = (typeof OAUTH_PROVIDER_NAMES)[number];

export function isOAuthProviderName(value: string): value is OAuthProviderName {
  return OAUTH_PROVIDER_NAMES.some((name) => name === value);
}

/** What a provider says about the person who signed in. */
export interface OAuthProfile {
  providerUserId: string;
  /** Set only when the provider says the address is verified (A4). */
  email: string | null;
  displayName: string | null;
  avatarUrl: string | null;
}

/** The OAuth client of one provider: its secrets, read from the environment of the request. */
export interface OAuthCredentials {
  clientId: string;
  clientSecret: string;
}

/**
 * One provider behind the seam of D2: Arctic sits below it and uses the global `fetch`, which a
 * test cannot replace, so the tests replace this instead. `codeVerifier` is the PKCE verifier;
 * GitHub ignores it.
 */
export interface OAuthProvider {
  authorizationUrl(
    credentials: OAuthCredentials,
    state: string,
    codeVerifier: string,
    redirectUri: string,
  ): URL;
  profile(
    credentials: OAuthCredentials,
    code: string,
    codeVerifier: string,
    redirectUri: string,
  ): Promise<OAuthProfile>;
}

export type OAuthProviders = Readonly<Record<OAuthProviderName, OAuthProvider>>;

/** What the application needs from outside, so a test can pass fakes (D2). */
export interface AppDeps {
  clock: Clock;
  randomBytes: (n: number) => Uint8Array;
  oauth: OAuthProviders;
}

export type AppBindings = { Bindings: Env; Variables: { userId: string } };
