import type { Context } from 'hono';
import { deleteCookie, getCookie, setCookie } from 'hono/cookie';
import { createMiddleware } from 'hono/factory';
import { deleteSession, extendSession, findSession, insertSession } from '../db/sessions';
import type { AppBindings } from '../env';
import { ApiError } from '../lib/errors';

export const SESSION_COOKIE = 'nt_session';
const DAY_MS = 24 * 60 * 60 * 1000;
/** A session lives 30 days and is renewed when less than 15 remain (docs/spec/backend.md). */
const SESSION_LIFETIME_MS = 30 * DAY_MS;
const RENEW_BELOW_MS = 15 * DAY_MS;

export function base64url(bytes: Uint8Array): string {
  let binary = '';
  for (const byte of bytes) binary += String.fromCharCode(byte);
  return btoa(binary).replaceAll('+', '-').replaceAll('/', '_').replaceAll('=', '');
}

/** The SHA-256 digest in hex: all that D1 keeps of a session token. */
export async function hashToken(token: string): Promise<string> {
  const digest = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(token));
  return Array.from(new Uint8Array(digest), (byte) => byte.toString(16).padStart(2, '0')).join('');
}

/** `Secure` everywhere but local development and the e2e server, which serve plain `http://` (D6). */
export function isSecureOrigin(appOrigin: string | undefined): boolean {
  return appOrigin === undefined || !appOrigin.startsWith('http://');
}

/** The attributes of `nt_session` (docs/spec/backend.md); `Secure` as in D6. */
function cookieOptions(c: Context<AppBindings>) {
  return {
    httpOnly: true,
    secure: isSecureOrigin(c.env.APP_ORIGIN),
    sameSite: 'Lax',
    path: '/',
  } as const;
}

function writeSessionCookie(c: Context<AppBindings>, token: string): void {
  setCookie(c, SESSION_COOKIE, token, {
    ...cookieOptions(c),
    maxAge: SESSION_LIFETIME_MS / 1000,
  });
}

/** Opens a session for `userId`: a random token in the cookie, its hash in D1. */
export async function startSession(
  c: Context<AppBindings>,
  userId: string,
  now: number,
  randomBytes: (n: number) => Uint8Array,
): Promise<void> {
  const token = base64url(randomBytes(32));
  const expiresAt = now + SESSION_LIFETIME_MS;
  await insertSession(c.env.DB, await hashToken(token), userId, expiresAt, now);
  writeSessionCookie(c, token);
}

/** Deletes the session row of the request's cookie, if any, and the cookie. */
export async function endSession(c: Context<AppBindings>): Promise<void> {
  const token = getCookie(c, SESSION_COOKIE);
  if (token !== undefined) await deleteSession(c.env.DB, await hashToken(token));
  deleteCookie(c, SESSION_COOKIE, cookieOptions(c));
}

/**
 * Puts `userId` into the context or answers `401`. One query for a valid session, one more when it
 * is renewed; an expired row is deleted when it is seen (D6).
 */
export function requireSession(clock: { now(): number }) {
  return createMiddleware<AppBindings>(async (c, next) => {
    const token = getCookie(c, SESSION_COOKIE);
    if (token === undefined) throw new ApiError('unauthenticated');
    const idHash = await hashToken(token);
    const session = await findSession(c.env.DB, idHash);
    if (session === null) throw new ApiError('unauthenticated');
    const now = clock.now();
    if (session.expiresAt <= now) {
      await deleteSession(c.env.DB, idHash);
      throw new ApiError('unauthenticated');
    }
    if (session.expiresAt - now < RENEW_BELOW_MS) {
      const expiresAt = now + SESSION_LIFETIME_MS;
      await extendSession(c.env.DB, idHash, expiresAt);
      writeSessionCookie(c, token);
    }
    c.set('userId', session.userId);
    await next();
  });
}
