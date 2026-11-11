import { describe, it, expect } from 'vitest';
import { canonical, compile, extend, isComplete, start, step } from './engine';
import type { MatchState, Matcher } from './engine';
import { wordsFixture, phrasesFixture } from '../model/fixtures';
import type { PromptItem } from '../model/types';

function feed(m: Matcher, input: string, from?: MatchState): MatchState | null {
  let current: MatchState | null = from ?? start(m);
  for (const ch of input) {
    if (!current) return null;
    current = step(m, current, ch);
  }
  return current;
}

class DeterministicRng {
  private s: number;
  constructor(seed = 98765) {
    this.s = seed;
  }
  next(): number {
    this.s = (this.s * 1103515245 + 12345) & 0x7fffffff;
    return this.s / 0x7fffffff;
  }
  pick<T>(items: readonly T[]): T {
    const item = items[Math.floor(this.next() * items.length)];
    if (item === undefined) throw new Error('empty');
    return item;
  }
}

const KEYS = "abcdefghijklmnopqrstuvwxyz-'".split('');

// Every word and phrase of the hand-written fixtures, with its reading hints.
const allPrompts: PromptItem[] = [...wordsFixture, ...phrasesFixture].map((c) => ({
  key: c.id,
  text: c.text,
  ...(c.readingHints ? { readingHints: c.readingHints } : {}),
}));

describe('engine over the baseline words and phrases', () => {
  it('every prompt compiles in both modes and its canonical spelling completes it', () => {
    for (const prompt of allPrompts) {
      for (const mode of ['ime', 'learner'] as const) {
        const m = compile([prompt], mode);
        const canon = canonical(m, 0);
        expect(canon.length, prompt.key).toBeGreaterThan(0);
        const end = feed(m, canon);
        expect(end, `${prompt.key} ${mode} ← ${canon}`).not.toBeNull();
        expect(end !== null && isComplete(m, end)).toBe(true);
      }
    }
  });

  it('random walks always reach the end, and relaxed accepts what strict accepts', () => {
    const rng = new DeterministicRng(54321);
    for (const prompt of allPrompts) {
      const strict = compile([prompt], 'ime');
      const relaxed = compile([prompt], 'learner');
      for (let walk = 0; walk < 5; walk++) {
        let s = start(strict);
        let typed = '';
        while (!isComplete(strict, s) || rng.next() < 0.3) {
          const accepted = KEYS.filter((k) => step(strict, s, k) !== null);
          if (accepted.length === 0) break;
          const key = rng.pick(accepted);
          const next = step(strict, s, key);
          if (next === null) break;
          s = next;
          typed += key;
        }
        expect(isComplete(strict, s), `${prompt.key} ← ${typed}`).toBe(true);
        const replay = feed(relaxed, typed);
        expect(replay, `${prompt.key} relaxed ← ${typed}`).not.toBeNull();
        expect(replay !== null && isComplete(relaxed, replay)).toBe(true);
      }
    }
  });

  it('the whole content typed as one stream, extended as it goes (D3)', () => {
    for (const mode of ['ime', 'learner'] as const) {
      let m = compile(allPrompts.slice(0, 2), mode);
      let s = start(m);
      for (let i = 0; i < allPrompts.length; i++) {
        const prompt = allPrompts[i];
        const following = allPrompts[i + 2];
        if (following !== undefined) m = extend(m, [following]);
        const keys = canonical(compile(prompt ? [prompt] : [], mode), 0);
        const next = feed(m, keys, s);
        expect(next, `${mode} prompt ${i} ← ${keys}`).not.toBeNull();
        if (next === null) return;
        s = next;
      }
      expect(isComplete(m, s)).toBe(true);
    }
  });
});
