import { corrupt, isRow, numberOf, textOf } from './rows';

export interface SessionRow {
  userId: string;
  expiresAt: number;
}

export async function findSession(db: D1Database, idHash: string): Promise<SessionRow | null> {
  const row = await db
    .prepare('SELECT user_id, expires_at FROM sessions WHERE id_hash = ?')
    .bind(idHash)
    .first();
  if (row === null) return null;
  const userId = isRow(row) ? textOf(row, 'user_id') : null;
  const expiresAt = isRow(row) ? numberOf(row, 'expires_at') : null;
  if (userId === null) throw corrupt('sessions', 'user_id');
  if (expiresAt === null) throw corrupt('sessions', 'expires_at');
  return { userId, expiresAt };
}

/** A sign-in adds the session and removes the user's other expired ones in one round trip (D6). */
export async function insertSession(
  db: D1Database,
  idHash: string,
  userId: string,
  expiresAt: number,
  now: number,
): Promise<void> {
  await db.batch([
    db.prepare('DELETE FROM sessions WHERE user_id = ? AND expires_at <= ?').bind(userId, now),
    db
      .prepare('INSERT INTO sessions (id_hash, user_id, expires_at) VALUES (?, ?, ?)')
      .bind(idHash, userId, expiresAt),
  ]);
}

export async function extendSession(
  db: D1Database,
  idHash: string,
  expiresAt: number,
): Promise<void> {
  await db
    .prepare('UPDATE sessions SET expires_at = ? WHERE id_hash = ?')
    .bind(expiresAt, idHash)
    .run();
}

export async function deleteSession(db: D1Database, idHash: string): Promise<void> {
  await db.prepare('DELETE FROM sessions WHERE id_hash = ?').bind(idHash).run();
}
