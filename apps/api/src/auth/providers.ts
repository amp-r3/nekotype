import { decodeIdToken, GitHub, Google } from 'arctic';
import { isObject } from '@nekotype/shared/runtime';
import type { OAuthProfile, OAuthProvider, OAuthProviders } from '../env';

// The Arctic-backed providers behind the seam of D2. Arctic calls the global `fetch`, so the API
// tests replace `OAuthProviders` as a whole and this file has a test of its own with a stubbed
// `fetch`.

const GOOGLE_SCOPES = ['openid', 'email', 'profile'];
const GITHUB_SCOPES = ['read:user', 'user:email'];

function stringOf(value: Readonly<Record<string, unknown>>, key: string): string | null {
  const field = value[key];
  return typeof field === 'string' && field !== '' ? field : null;
}

/**
 * The profile of Google's ID token. The token comes straight from Google's token endpoint over
 * TLS, so its signature is not checked again (D6). The address counts only when Google says it is
 * verified.
 */
export function googleProfile(claims: unknown): OAuthProfile {
  if (!isObject(claims)) throw new Error('The Google ID token has no claims');
  const providerUserId = stringOf(claims, 'sub');
  if (providerUserId === null) throw new Error('The Google ID token has no subject');
  const verified = claims['email_verified'] === true || claims['email_verified'] === 'true';
  return {
    providerUserId,
    email: verified ? stringOf(claims, 'email') : null,
    displayName: stringOf(claims, 'name'),
    avatarUrl: stringOf(claims, 'picture'),
  };
}

const google: OAuthProvider = {
  authorizationUrl: ({ clientId, clientSecret }, state, codeVerifier, redirectUri) =>
    new Google(clientId, clientSecret, redirectUri).createAuthorizationURL(
      state,
      codeVerifier,
      GOOGLE_SCOPES,
    ),
  profile: async ({ clientId, clientSecret }, code, codeVerifier, redirectUri) => {
    const tokens = await new Google(clientId, clientSecret, redirectUri).validateAuthorizationCode(
      code,
      codeVerifier,
    );
    return googleProfile(decodeIdToken(tokens.idToken()));
  },
};

async function githubJson(url: string, accessToken: string): Promise<unknown> {
  const response = await fetch(url, {
    headers: {
      Authorization: `Bearer ${accessToken}`,
      Accept: 'application/vnd.github+json',
      'User-Agent': 'nekotype',
    },
  });
  if (!response.ok) throw new Error(`GitHub answered ${response.status} to ${url}`);
  return response.json();
}

/** The primary address that GitHub has verified, or `null`. */
export function githubVerifiedEmail(emails: unknown): string | null {
  if (!Array.isArray(emails)) return null;
  for (const item of emails) {
    const entry: unknown = item;
    if (isObject(entry) && entry['primary'] === true && entry['verified'] === true) {
      return stringOf(entry, 'email');
    }
  }
  return null;
}

export function githubProfile(user: unknown, emails: unknown): OAuthProfile {
  if (!isObject(user)) throw new Error('GitHub returned no user');
  const id = user['id'];
  if (typeof id !== 'number' && typeof id !== 'string') throw new Error('GitHub returned no id');
  return {
    providerUserId: String(id),
    email: githubVerifiedEmail(emails),
    displayName: stringOf(user, 'name') ?? stringOf(user, 'login'),
    avatarUrl: stringOf(user, 'avatar_url'),
  };
}

const github: OAuthProvider = {
  authorizationUrl: ({ clientId, clientSecret }, state, _codeVerifier, redirectUri) =>
    new GitHub(clientId, clientSecret, redirectUri).createAuthorizationURL(state, GITHUB_SCOPES),
  profile: async ({ clientId, clientSecret }, code, _codeVerifier, redirectUri) => {
    const tokens = await new GitHub(clientId, clientSecret, redirectUri).validateAuthorizationCode(
      code,
    );
    const accessToken = tokens.accessToken();
    const user = await githubJson('https://api.github.com/user', accessToken);
    const emails = await githubJson('https://api.github.com/user/emails', accessToken);
    return githubProfile(user, emails);
  },
};

export const arcticProviders: OAuthProviders = { google, github };
