import type { KanaStat } from '@nekotype/shared/types';
import type { KanaStatMap } from '../model/types';

/** How often the kana was typed wrong, smoothed so that an unseen kana weighs 0.5. */
export function computeWeakness(stat?: KanaStat): number {
  const attempts = stat ? stat.attempts : 0;
  const errored = stat ? stat.erroredAttempts : 0;
  return (errored + 1) / (attempts + 2);
}

export function computeWeight(stat?: KanaStat): number {
  return 1 + 4 * computeWeakness(stat);
}

export function computeWeights(stats: KanaStatMap, keys: readonly string[]): Map<string, number> {
  const weights = new Map<string, number>();
  for (const k of keys) {
    weights.set(k, computeWeight(stats[k]));
  }
  return weights;
}

export function computeItemWeight(
  tokenKeys: readonly string[],
  weights: ReadonlyMap<string, number>,
): number {
  if (tokenKeys.length === 0) return 1;
  let sum = 0;
  for (const k of tokenKeys) {
    sum += weights.get(k) ?? 3; // default unseen = 3
  }
  return sum / tokenKeys.length;
}
