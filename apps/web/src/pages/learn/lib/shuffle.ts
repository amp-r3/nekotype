import type { Rng } from '@nekotype/shared/types';

/** A shuffled copy (Fisher–Yates) drawn from `rng`. */
export function shuffled<T>(items: readonly T[], rng: Rng): T[] {
  const result = [...items];
  for (let i = result.length - 1; i > 0; i--) {
    const j = Math.min(i, Math.floor(rng.next() * (i + 1)));
    const a = result[i];
    const b = result[j];
    if (a === undefined || b === undefined) continue;
    result[i] = b;
    result[j] = a;
  }
  return result;
}
