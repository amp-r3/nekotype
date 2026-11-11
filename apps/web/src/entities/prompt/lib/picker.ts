import type { PoolSettings, PromptItem, ContentItem } from '../model/types';
import type { Rng } from '@/shared/lib';

/**
 * The prompts for the selected script: the loaded words or phrases. Empty while the vocabulary is
 * not here or when it has nothing for the script; the caller shows no prompt then.
 */
export function buildPool(
  settings: PoolSettings,
  content?: readonly ContentItem[],
): readonly PromptItem[] {
  if (!content) return [];
  return (
    content
      // Mixed phrases have both scripts in them: offered only when both are selected.
      .filter((item) => settings.script === 'both' || item.script === settings.script)
      .map((item) => ({
        key: item.id,
        text: item.text,
        script: item.script,
        meaning: item.meaning,
        ...(item.readingHints ? { readingHints: item.readingHints } : {}),
        ...(item.tatoebaId !== undefined ? { tatoebaId: item.tatoebaId } : {}),
      }))
  );
}

export function pickPrompt(
  pool: readonly PromptItem[],
  weights: ReadonlyMap<string, number>,
  rng: Rng,
  previousKey: string | null,
): PromptItem {
  if (pool.length === 0) {
    throw new Error('Cannot pick prompt from empty pool');
  }

  if (pool.length === 1) {
    const single = pool[0];
    if (!single) throw new Error('Pool has no items');
    return single;
  }

  // Filter out previous key if pool has more than 1 item
  const candidates = pool.filter((item) => item.key !== previousKey);
  const eligible = candidates.length > 0 ? candidates : pool;

  // Calculate total weight
  let totalWeight = 0;
  for (const item of eligible) {
    const w = weights.get(item.key) ?? 1;
    totalWeight += Math.max(0.01, w);
  }

  let threshold = rng.next() * totalWeight;

  for (const item of eligible) {
    const w = Math.max(0.01, weights.get(item.key) ?? 1);
    if (threshold <= w) {
      return item;
    }
    threshold -= w;
  }

  const fallback = eligible[eligible.length - 1];
  if (!fallback) {
    throw new Error('Failed to select candidate from pool');
  }
  return fallback;
}
