/** Fills `n` bytes with random values. */
export type RandomBytes = (n: number) => Uint8Array;

const cryptoBytes: RandomBytes = (n) => crypto.getRandomValues(new Uint8Array(n));

/**
 * A UUID version 7 (RFC 9562): 48 bits of Unix time in milliseconds, then random bits. Ids made
 * later sort after earlier ones as strings. Time and randomness are injected so tests are exact.
 */
export function uuidv7(now: number, random: RandomBytes = cryptoBytes): string {
  const bytes = new Uint8Array(16);
  bytes.set(random(10), 6);
  const time = Math.max(0, Math.floor(now));
  // 48-bit big-endian time; division instead of shifts, because shifts work on 32 bits.
  for (let i = 5, rest = time; i >= 0; i--) {
    bytes[i] = rest % 256;
    rest = Math.floor(rest / 256);
  }
  bytes[6] = ((bytes[6] ?? 0) & 0x0f) | 0x70;
  bytes[8] = ((bytes[8] ?? 0) & 0x3f) | 0x80;
  const hex = Array.from(bytes, (b) => b.toString(16).padStart(2, '0')).join('');
  return `${hex.slice(0, 8)}-${hex.slice(8, 12)}-${hex.slice(12, 16)}-${hex.slice(16, 20)}-${hex.slice(20)}`;
}
