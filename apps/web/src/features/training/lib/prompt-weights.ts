import type { PromptItem } from '@/entities/prompt';
import { compile } from '@/entities/prompt';
import type { KanaStatMap } from '@/entities/stats';
import { computeItemWeight, computeWeights } from '@/entities/stats';

export type PromptWeights = (
  pool: readonly PromptItem[],
  stats: KanaStatMap,
) => Map<string, number>;

/**
 * Weight of a prompt for the weak-kana picker (D20): the mean weight of the kana it is made of.
 * A single kana weighs what it did before; a word or phrase now reflects its kana instead of
 * always getting the default weight of an unseen prompt id.
 *
 * Kana keys per text are cached, so a pool is compiled once, not on every picked prompt.
 * Tokens without a KanaKey (standalone っ, ー) do not count, as in the statistics.
 */
export function createPromptWeights(): PromptWeights {
  const kanaKeysByText = new Map<string, readonly string[]>();

  const kanaKeys = (item: PromptItem): readonly string[] => {
    const cached = kanaKeysByText.get(item.text);
    if (cached) return cached;
    const keys: string[] = [];
    for (const token of compile([item], 'learner').tokens) {
      if (token.kanaKey !== null) keys.push(token.kanaKey);
    }
    kanaKeysByText.set(item.text, keys);
    return keys;
  };

  return (pool, stats) => {
    const perPrompt = pool.map((item) => ({ key: item.key, kanaKeys: kanaKeys(item) }));
    const kanaWeights = computeWeights(
      stats,
      perPrompt.flatMap((p) => p.kanaKeys),
    );
    const weights = new Map<string, number>();
    for (const p of perPrompt) {
      weights.set(p.key, computeItemWeight(p.kanaKeys, kanaWeights));
    }
    return weights;
  };
}
