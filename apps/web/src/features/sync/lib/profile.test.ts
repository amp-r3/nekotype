import { describe, expect, it } from 'vitest';
import { readPendingSignIn, readProfile } from './profile';

describe('the stored profile and pending sign-in', () => {
  it('reads a profile, with missing names as null', () => {
    expect(readProfile({ provider: 'github' })).toEqual({
      displayName: null,
      email: null,
      provider: 'github',
    });
    expect(readProfile({ displayName: 'a', email: 'a@b.c', provider: 'google' })).toEqual({
      displayName: 'a',
      email: 'a@b.c',
      provider: 'google',
    });
  });

  it('ignores a malformed profile or pending sign-in', () => {
    expect(readProfile({ displayName: 'a', provider: 'gitlab' })).toBeNull();
    expect(readProfile(null)).toBeNull();
    expect(readPendingSignIn('github')).toBeNull();
    expect(readPendingSignIn({ provider: 'google' })).toBe('google');
  });
});
