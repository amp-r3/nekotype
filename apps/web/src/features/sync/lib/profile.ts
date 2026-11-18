import { isObject } from '@nekotype/shared/runtime';
import type { AuthProvider } from '@/entities/user';

/** `meta.profile`: what the account panel shows, offline too. */
export type Profile = {
  readonly displayName: string | null;
  readonly email: string | null;
  readonly provider: AuthProvider;
};

export function isAuthProvider(value: unknown): value is AuthProvider {
  return value === 'google' || value === 'github';
}

const asNullableString = (value: unknown): string | null =>
  typeof value === 'string' ? value : null;

/** `meta.profile`, or null when it is absent or malformed. */
export function readProfile(value: unknown): Profile | null {
  if (!isObject(value) || !isAuthProvider(value['provider'])) return null;
  return {
    displayName: asNullableString(value['displayName']),
    email: asNullableString(value['email']),
    provider: value['provider'],
  };
}

/** `meta.pendingSignIn`: the provider of a sign-in that left the page, or null. */
export function readPendingSignIn(value: unknown): AuthProvider | null {
  return isObject(value) && isAuthProvider(value['provider']) ? value['provider'] : null;
}
