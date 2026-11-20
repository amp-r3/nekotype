import type { OAuthProfile, OAuthProviderName } from '../env';
import { corrupt, isRow, textOf } from './rows';

/**
 * The initial `user_stats` row (p5-plan.md, D6): the neutral element of every column. The two typing
 * columns of P5 are still `NOT NULL` until migration 0003 drops them (p6-plan.md, D9), so the insert
 * names them.
 */
const TYPING_COLUMNS_UNTIL_0003 = '{}';

const INITIAL_STATS = {
  counters: JSON.stringify({ started: 0, finished: 0 }),
  learn: JSON.stringify({
    unlocked: { hiragana: [], katakana: [] },
    entries: {},
    stats: {},
    activeDays: [],
  }),
  learn_recent: '{}',
  learn_buckets: JSON.stringify({ hiragana: {}, katakana: {} }),
  bucket_newest: '{}',
  device_seq: '{}',
};

export async function findUserIdByOAuthAccount(
  db: D1Database,
  provider: OAuthProviderName,
  providerUserId: string,
): Promise<string | null> {
  const row = await db
    .prepare('SELECT user_id FROM oauth_accounts WHERE provider = ? AND provider_user_id = ?')
    .bind(provider, providerUserId)
    .first();
  if (row === null) return null;
  const userId = isRow(row) ? textOf(row, 'user_id') : null;
  if (userId === null) throw corrupt('oauth_accounts', 'user_id');
  return userId;
}

/** `email` is a verified address in lower case; the oldest user holding it wins a race. */
export async function findUserIdByEmail(db: D1Database, email: string): Promise<string | null> {
  const row = await db
    .prepare('SELECT id FROM users WHERE email = ? ORDER BY created_at, id LIMIT 1')
    .bind(email)
    .first();
  if (row === null) return null;
  const id = isRow(row) ? textOf(row, 'id') : null;
  if (id === null) throw corrupt('users', 'id');
  return id;
}

export function linkOAuthAccountStatement(
  db: D1Database,
  userId: string,
  provider: OAuthProviderName,
  providerUserId: string,
): D1PreparedStatement {
  return db
    .prepare(
      'INSERT OR IGNORE INTO oauth_accounts (provider, provider_user_id, user_id) VALUES (?, ?, ?)',
    )
    .bind(provider, providerUserId, userId);
}

/** The user, its first sign-in method and its `user_stats` row are written together (D6). */
export async function createUser(
  db: D1Database,
  userId: string,
  provider: OAuthProviderName,
  profile: OAuthProfile,
  now: number,
): Promise<void> {
  await db.batch([
    db
      .prepare(
        'INSERT INTO users (id, email, display_name, avatar_url, created_at) VALUES (?, ?, ?, ?, ?)',
      )
      .bind(userId, profile.email, profile.displayName, profile.avatarUrl, now),
    linkOAuthAccountStatement(db, userId, provider, profile.providerUserId),
    db
      .prepare(
        `INSERT INTO user_stats (user_id, kana_stats, counters, learn, learn_recent, learn_buckets,
           bucket_newest, typing_records, device_seq, last_sync_at)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, 0)`,
      )
      .bind(
        userId,
        TYPING_COLUMNS_UNTIL_0003,
        INITIAL_STATS.counters,
        INITIAL_STATS.learn,
        INITIAL_STATS.learn_recent,
        INITIAL_STATS.learn_buckets,
        INITIAL_STATS.bucket_newest,
        TYPING_COLUMNS_UNTIL_0003,
        INITIAL_STATS.device_seq,
      ),
  ]);
}

export interface UserProfile {
  id: string;
  email: string | null;
  displayName: string | null;
  avatarUrl: string | null;
}

export async function findUserProfile(db: D1Database, userId: string): Promise<UserProfile | null> {
  const row = await db
    .prepare('SELECT id, email, display_name, avatar_url FROM users WHERE id = ?')
    .bind(userId)
    .first();
  if (row === null) return null;
  if (!isRow(row)) throw corrupt('users', 'id');
  const id = textOf(row, 'id');
  if (id === null) throw corrupt('users', 'id');
  return {
    id,
    email: textOf(row, 'email'),
    displayName: textOf(row, 'display_name'),
    avatarUrl: textOf(row, 'avatar_url'),
  };
}

/**
 * Deletes the account in one `batch()` (one transaction): its reports keep their row with no user,
 * then the `users` row goes and the foreign keys cascade over every other table (D1 enforces them).
 */
export async function deleteUser(db: D1Database, userId: string): Promise<void> {
  await db.batch([
    db.prepare('UPDATE content_reports SET user_id = NULL WHERE user_id = ?').bind(userId),
    db.prepare('DELETE FROM users WHERE id = ?').bind(userId),
  ]);
}
