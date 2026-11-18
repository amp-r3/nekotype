import type { AppDeps, OAuthProfile, OAuthProviderName, OAuthProviders } from './env';

/** The fake of D2: a code stands for a profile; any other code is a failed exchange. */
export function fakeOAuth(profiles: Readonly<Record<string, OAuthProfile>>): OAuthProviders {
  const provider = (name: OAuthProviderName) => ({
    authorizationUrl: (
      _credentials: unknown,
      state: string,
      codeVerifier: string,
      redirectUri: string,
    ) =>
      new URL(
        `https://idp.example/${name}?${new URLSearchParams({ state, codeVerifier, redirectUri })}`,
      ),
    profile: (_credentials: unknown, code: string) => {
      const profile = profiles[code];
      return profile === undefined
        ? Promise.reject(new Error(`unknown code ${code}`))
        : Promise.resolve(profile);
    },
  });
  return { google: provider('google'), github: provider('github') };
}

/** A clock a test moves by hand, and deterministic bytes that differ per call. */
export function testDeps(
  profiles: Readonly<Record<string, OAuthProfile>> = {},
  start = 1_700_000_000_000,
): { deps: AppDeps; clock: { time: number } } {
  const clock = { time: start };
  let calls = 0;
  return {
    clock,
    deps: {
      clock: { now: () => clock.time },
      randomBytes: (n) => new Uint8Array(n).fill(++calls),
      oauth: fakeOAuth(profiles),
    },
  };
}
