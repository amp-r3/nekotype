import { readFileSync } from 'node:fs';
import { isObject } from '@nekotype/shared/runtime';
import type { Item } from './items';

/** A word or phrase of the generated content, or of a pool of `scripts/p9-jmdict.py`. */
export interface Text {
  readonly id: string;
  readonly text: string;
  readonly meaning: string;
  readonly script: string;
}

const CONTENT = new URL('../../../apps/web/src/entities/prompt/content/', import.meta.url);

/** A committed chunk by name (`words-hiragana`), or a file in the chunk format. */
export function load(chunk: string | URL): readonly Text[] {
  const file = typeof chunk === 'string' ? new URL(`${chunk}.json`, CONTENT) : chunk;
  const data: unknown = JSON.parse(readFileSync(file, 'utf8'));
  if (!Array.isArray(data)) throw new Error(`${String(chunk)} is not an array`);
  return data.flatMap((entry: unknown): Text[] => {
    if (!isObject(entry)) return [];
    const { id, text, script, meaning } = entry;
    const en = isObject(meaning) ? meaning['en'] : undefined;
    if (typeof id !== 'string' || typeof text !== 'string' || typeof script !== 'string') return [];
    return [{ id, text, script, meaning: typeof en === 'string' ? en : '' }];
  });
}

/**
 * The item ids of a word's kana in reading order, longest match first as the engine splits a
 * prompt; っ and ー are skipped (taught as rules, not items). Undefined when a character is
 * neither a kana of `items` nor っ or ー.
 */
export function wordKana(text: string, items: readonly Item[]): readonly number[] | undefined {
  const idOf = new Map(items.map((item) => [item.kana, item.id]));
  const chars = Array.from(text);
  const ids: number[] = [];
  for (let at = 0; at < chars.length;) {
    const two = at + 1 < chars.length ? idOf.get(chars.slice(at, at + 2).join('')) : undefined;
    if (two !== undefined) {
      ids.push(two);
      at += 2;
      continue;
    }
    const char = chars[at] ?? '';
    const one = idOf.get(char);
    if (one !== undefined) ids.push(one);
    else if (char !== 'っ' && char !== 'ッ' && char !== 'ー') return undefined;
    at += 1;
  }
  return ids;
}
