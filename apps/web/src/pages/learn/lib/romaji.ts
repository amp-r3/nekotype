import type { LearnKanaKey } from '@nekotype/shared/types';
import { canonicalFor } from '@/entities/prompt';

/**
 * The romaji learning shows for a kana (ADR 062): the table's canonical spelling, except ん and ン,
 * which end a task on one `n`, so `nn` would teach a keystroke the learner does not need.
 */
export function displayRomaji(key: LearnKanaKey): string {
  const kana = key.slice(key.indexOf(':') + 1);
  return kana === 'ん' || kana === 'ン' ? 'n' : canonicalFor(key);
}
