import { hashToken } from './auth/session';
import { createUser } from './db/users';

// Helpers of the API tests (p5-plan.md, D8): a wrapper that counts the statements of a request and
// sums the rows it wrote, and the means to sign a user in.

export interface DbLog {
  /** Statements executed, in or out of a `batch()`. */
  statements: number;
  rowsWritten: number;
  rowsRead: number;
}

interface CountingOptions {
  /** Called once before the first `batch()` that holds an `UPDATE user_stats`: another request wins. */
  beforeUpdate?: () => Promise<void>;
  /** Called before every such `batch()`. */
  beforeEveryUpdate?: () => Promise<void>;
}

const STATEMENT_METHODS = new Set(['first', 'run', 'all', 'raw']);

/**
 * The database with a log of what runs on it. A `Proxy` keeps the real type, so no assertion is
 * needed; statements are unwrapped before `batch()`, which needs the real objects.
 */
export function countingDb(
  db: D1Database,
  options: CountingOptions = {},
): { db: D1Database; log: DbLog; reset(): void } {
  const log: DbLog = { statements: 0, rowsWritten: 0, rowsRead: 0 };
  const originals = new WeakMap<object, { statement: D1PreparedStatement; sql: string }>();
  let hooked = false;

  const addMeta = (result: unknown): void => {
    if (typeof result !== 'object' || result === null || !('meta' in result)) return;
    const meta = result.meta;
    if (typeof meta !== 'object' || meta === null) return;
    if ('rows_written' in meta && typeof meta.rows_written === 'number') {
      log.rowsWritten += meta.rows_written;
    }
    if ('rows_read' in meta && typeof meta.rows_read === 'number') log.rowsRead += meta.rows_read;
  };

  const wrap = (statement: D1PreparedStatement, sql: string): D1PreparedStatement => {
    const proxy: D1PreparedStatement = new Proxy(statement, {
      get(target, property) {
        const value: unknown = Reflect.get(target, property, target);
        if (typeof value !== 'function') return value;
        if (property === 'bind') {
          return (...values: unknown[]) => wrap(target.bind(...values), sql);
        }
        if (typeof property === 'string' && STATEMENT_METHODS.has(property)) {
          return async (...args: unknown[]) => {
            log.statements += 1;
            const result: unknown = await value.apply(target, args);
            addMeta(result);
            return result;
          };
        }
        return (...args: unknown[]): unknown => Reflect.apply(value, target, args);
      },
    });
    originals.set(proxy, { statement, sql });
    return proxy;
  };

  const proxy: D1Database = new Proxy(db, {
    get(target, property) {
      const value: unknown = Reflect.get(target, property, target);
      if (typeof value !== 'function') return value;
      if (property === 'prepare') return (sql: string) => wrap(target.prepare(sql), sql);
      if (property === 'batch') {
        return async (statements: readonly D1PreparedStatement[]) => {
          const known = statements.map((statement) => originals.get(statement));
          const real = statements.map((statement, index) => known[index]?.statement ?? statement);
          const updates = known.some((item) => item?.sql.startsWith('UPDATE user_stats'));
          if (updates) {
            await options.beforeEveryUpdate?.();
            if (!hooked) {
              hooked = true;
              await options.beforeUpdate?.();
            }
          }
          log.statements += statements.length;
          const results: unknown = await target.batch(real);
          if (Array.isArray(results)) for (const result of results) addMeta(result);
          return results;
        };
      }
      return (...args: unknown[]): unknown => Reflect.apply(value, target, args);
    },
  });
  return {
    db: proxy,
    log,
    reset() {
      log.statements = 0;
      log.rowsWritten = 0;
      log.rowsRead = 0;
    },
  };
}

/** A user with its `user_stats` row and a session; returns the cookie header of the session. */
export async function signedInUser(
  db: D1Database,
  userId: string,
  now: number,
): Promise<{ cookie: string }> {
  await createUser(
    db,
    userId,
    'google',
    { providerUserId: `g-${userId}`, email: null, displayName: null, avatarUrl: null },
    now,
  );
  const token = `token-${userId}`;
  await db
    .prepare('INSERT INTO sessions (id_hash, user_id, expires_at) VALUES (?, ?, ?)')
    .bind(await hashToken(token), userId, now + 30 * 24 * 60 * 60 * 1000)
    .run();
  return { cookie: `nt_session=${token}` };
}
