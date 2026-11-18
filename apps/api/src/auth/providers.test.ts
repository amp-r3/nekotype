import { afterEach, describe, expect, it, vi } from 'vitest';
import { arcticProviders, githubVerifiedEmail } from './providers';

const credentials = { clientId: 'client-id', clientSecret: 'client-secret' };
const redirectUri = 'http://localhost:5173/api/auth/google/callback';

function jwt(claims: Record<string, unknown>): string {
  const part = (value: unknown) =>
    btoa(JSON.stringify(value)).replaceAll('+', '-').replaceAll('/', '_').replaceAll('=', '');
  return `${part({ alg: 'RS256' })}.${part(claims)}.signature`;
}

function stubFetch(answer: (url: string) => Response) {
  const asked: { url: string; init: RequestInit | undefined }[] = [];
  vi.stubGlobal('fetch', (input: RequestInfo | URL, init?: RequestInit) => {
    const url = input instanceof Request ? input.url : input.toString();
    asked.push({ url, init });
    return Promise.resolve(answer(url));
  });
  return asked;
}

afterEach(() => {
  vi.unstubAllGlobals();
});

describe('Google', () => {
  it('asks for openid, email and profile with PKCE and the state', () => {
    const url = arcticProviders.google.authorizationUrl(
      credentials,
      'the-state',
      'the-verifier',
      redirectUri,
    );
    expect(url.origin + url.pathname).toBe('https://accounts.google.com/o/oauth2/v2/auth');
    expect(url.searchParams.get('state')).toBe('the-state');
    expect(url.searchParams.get('scope')).toBe('openid email profile');
    expect(url.searchParams.get('code_challenge_method')).toBe('S256');
    expect(url.searchParams.get('client_id')).toBe('client-id');
    expect(url.searchParams.get('redirect_uri')).toBe(redirectUri);
  });

  it('reads the profile from the ID token claims and makes no other request', async () => {
    const asked = stubFetch(() =>
      Response.json({
        access_token: 'a',
        token_type: 'Bearer',
        id_token: jwt({
          sub: '1234',
          email: 'a@example.com',
          email_verified: true,
          name: 'Alice',
          picture: 'https://img.example/a.png',
        }),
      }),
    );
    const profile = await arcticProviders.google.profile(
      credentials,
      'code',
      'the-verifier',
      redirectUri,
    );
    expect(profile).toEqual({
      providerUserId: '1234',
      email: 'a@example.com',
      displayName: 'Alice',
      avatarUrl: 'https://img.example/a.png',
    });
    expect(asked).toHaveLength(1);
    expect(asked[0]?.url).toBe('https://oauth2.googleapis.com/token');
  });

  it('drops an address that Google does not call verified', async () => {
    stubFetch(() =>
      Response.json({
        access_token: 'a',
        token_type: 'Bearer',
        id_token: jwt({ sub: '1', email: 'a@example.com', email_verified: false }),
      }),
    );
    const profile = await arcticProviders.google.profile(credentials, 'code', 'v', redirectUri);
    expect(profile.email).toBeNull();
    expect(profile.displayName).toBeNull();
  });

  it('fails when the token endpoint refuses the code', async () => {
    stubFetch(() => Response.json({ error: 'invalid_grant' }, { status: 400 }));
    await expect(
      arcticProviders.google.profile(credentials, 'bad', 'v', redirectUri),
    ).rejects.toThrow();
  });
});

describe('GitHub', () => {
  const githubRedirect = 'http://localhost:5173/api/auth/github/callback';

  it('asks for read:user and user:email', () => {
    const url = arcticProviders.github.authorizationUrl(
      credentials,
      's',
      'ignored',
      githubRedirect,
    );
    expect(url.origin + url.pathname).toBe('https://github.com/login/oauth/authorize');
    expect(url.searchParams.get('scope')).toBe('read:user user:email');
    expect(url.searchParams.get('state')).toBe('s');
  });

  it('takes the primary verified address and sends a User-Agent', async () => {
    const asked = stubFetch((url) => {
      if (url === 'https://github.com/login/oauth/access_token') {
        return Response.json({ access_token: 'gho_x', token_type: 'bearer', scope: '' });
      }
      if (url === 'https://api.github.com/user') {
        return Response.json({ id: 42, login: 'alice', name: null, avatar_url: 'https://a/b.png' });
      }
      return Response.json([
        { email: 'old@example.com', primary: false, verified: true },
        { email: 'Alice@Example.com', primary: true, verified: true },
      ]);
    });
    const profile = await arcticProviders.github.profile(credentials, 'code', 'x', githubRedirect);
    expect(profile).toEqual({
      providerUserId: '42',
      email: 'Alice@Example.com',
      displayName: 'alice',
      avatarUrl: 'https://a/b.png',
    });
    // The code exchange and the two profile requests: three of the 50 subrequests (D6).
    expect(asked).toHaveLength(3);
    for (const { url, init } of asked.slice(1)) {
      expect(url).toMatch(/^https:\/\/api\.github\.com\//);
      expect(new Headers(init?.headers).get('User-Agent')).toBe('nekotype');
      expect(new Headers(init?.headers).get('Authorization')).toBe('Bearer gho_x');
    }
  });

  it('fails when GitHub refuses the profile request', async () => {
    stubFetch((url) =>
      url === 'https://github.com/login/oauth/access_token'
        ? Response.json({ access_token: 'gho_x', token_type: 'bearer' })
        : new Response('nope', { status: 401 }),
    );
    await expect(
      arcticProviders.github.profile(credentials, 'code', 'x', githubRedirect),
    ).rejects.toThrow(/401/);
  });

  it('counts no address that is unverified or not primary', () => {
    expect(
      githubVerifiedEmail([
        { email: 'a@example.com', primary: true, verified: false },
        { email: 'b@example.com', primary: false, verified: true },
      ]),
    ).toBeNull();
    expect(githubVerifiedEmail('not a list')).toBeNull();
  });
});
