/** A seeded random source: `next()` is uniform in [0, 1). */
export interface Rng {
  next(): number;
}

/** mulberry32: small, fast and good enough for simulations; the same seed gives the same stream. */
export function createRng(seed: number): Rng {
  let state = seed >>> 0;
  return {
    next() {
      state = (state + 0x6d2b79f5) >>> 0;
      let t = state;
      t = Math.imul(t ^ (t >>> 15), t | 1);
      t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
      return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
    },
  };
}

/** A standard normal draw (Box–Muller). */
export function normal(rng: Rng): number {
  const u = Math.max(rng.next(), Number.EPSILON);
  const v = rng.next();
  return Math.sqrt(-2 * Math.log(u)) * Math.cos(2 * Math.PI * v);
}

/** A log-normal factor with median 1. */
export function logNormal(rng: Rng, sigma: number): number {
  return Math.exp(sigma * normal(rng));
}

/** An index drawn with probability proportional to its weight; -1 when every weight is 0. */
export function weighted(rng: Rng, weights: readonly number[]): number {
  const total = weights.reduce((sum, w) => sum + w, 0);
  if (total <= 0) return -1;
  let r = rng.next() * total;
  for (const [i, w] of weights.entries()) {
    r -= w;
    if (r < 0) return i;
  }
  return weights.length - 1;
}
