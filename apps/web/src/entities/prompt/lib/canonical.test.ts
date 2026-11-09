import { createEngine, engineTable } from '@nekotype/engine';
import { describe, expect, it } from 'vitest';
import { canonicalFor } from './canonical';

const engineCanonicalFor = createEngine(engineTable).canonicalFor;

describe('canonicalFor', () => {
  it('agrees with the engine for every kana of the table', () => {
    for (const row of engineTable) {
      for (const entry of row.entries) {
        if (entry.hiragana !== undefined) {
          expect(canonicalFor(`hiragana:${entry.hiragana}`)).toBe(
            engineCanonicalFor(`hiragana:${entry.hiragana}`),
          );
        }
        expect(canonicalFor(`katakana:${entry.katakana}`)).toBe(
          engineCanonicalFor(`katakana:${entry.katakana}`),
        );
      }
    }
  });

  it('is empty for an unknown key', () => {
    expect(canonicalFor('hiragana:x')).toBe('');
  });
});
