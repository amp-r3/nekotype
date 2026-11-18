import {
  createUser,
  findUserIdByEmail,
  findUserIdByOAuthAccount,
  linkOAuthAccountStatement,
} from '../db/users';
import type { OAuthProfile, OAuthProviderName } from '../env';

/** A verified address in lower case, or `null`: an unverified one is never stored (S2). */
function normalizedEmail(email: string | null): string | null {
  const trimmed = email?.trim().toLowerCase() ?? '';
  return trimmed === '' ? null : trimmed;
}

/**
 * The user of a sign-in (A4): the one already linked to `(provider, providerUserId)`; else the one
 * with the same verified address, who gets the new sign-in method; else a new user with its
 * `user_stats` row. Returns the user's id.
 */
export async function findOrCreateUser(
  db: D1Database,
  provider: OAuthProviderName,
  profile: OAuthProfile,
  now: number,
): Promise<string> {
  const linked = await findUserIdByOAuthAccount(db, provider, profile.providerUserId);
  if (linked !== null) return linked;

  const email = normalizedEmail(profile.email);
  const sameEmail = email === null ? null : await findUserIdByEmail(db, email);
  if (sameEmail !== null) {
    await linkOAuthAccountStatement(db, sameEmail, provider, profile.providerUserId).run();
    return sameEmail;
  }

  const userId = crypto.randomUUID();
  await createUser(db, userId, provider, { ...profile, email }, now);
  return userId;
}
