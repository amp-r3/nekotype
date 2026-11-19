const SITEVERIFY_URL = 'https://challenges.cloudflare.com/turnstile/v0/siteverify';

/**
 * Cloudflare's published test secrets (always passes, always fails, token already spent). They
 * work on any host, so production must never hold one (p5-plan.md, D21).
 */
const TEST_SECRETS: ReadonlySet<string> = new Set([
  '1x0000000000000000000000000000000AA',
  '2x0000000000000000000000000000000AA',
  '3x0000000000000000000000000000000AA',
]);

export function isTestSecret(secret: string): boolean {
  return TEST_SECRETS.has(secret);
}

/**
 * Asks Cloudflare whether a Turnstile token passed. It rejects when Cloudflare cannot be asked
 * (the network, a non-2xx answer), which is not the same as a token that failed.
 */
export async function verifyTurnstile(
  token: string,
  ip: string | null,
  secret: string,
): Promise<boolean> {
  const form = new FormData();
  form.set('secret', secret);
  form.set('response', token);
  if (ip !== null) form.set('remoteip', ip);
  const response = await fetch(SITEVERIFY_URL, { method: 'POST', body: form });
  if (!response.ok) throw new Error(`siteverify answered ${response.status}`);
  const body: unknown = await response.json();
  return typeof body === 'object' && body !== null && 'success' in body && body.success === true;
}
