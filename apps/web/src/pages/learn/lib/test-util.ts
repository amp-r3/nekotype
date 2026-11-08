import type {
  LearnEntry,
  LearnKanaKey,
  LearnState,
  RecallAnswer,
  Rng,
} from '@nekotype/shared/types';
import { initialLearnState, keyOf } from '@/entities/learn';

/** Mulberry32: a small seeded generator with good low bits, for statistical tests. */
export function seededRng(seed: number): Rng {
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

export const key = (kana: string): LearnKanaKey => keyOf('hiragana', kana);

export function answers(count: number, ms: number, okEvery = 0): RecallAnswer[] {
  return Array.from({ length: count }, (_, i) => ({
    at: i + 1,
    ms,
    ok: okEvery === 0 || (i + 1) % okEvery !== 0,
  }));
}

export function stateWith(parts: {
  unlocked?: readonly string[];
  entries?: Record<string, Partial<LearnEntry>>;
  recent?: Record<string, readonly RecallAnswer[]>;
}): LearnState {
  const base = initialLearnState();
  const entries: Record<LearnKanaKey, LearnEntry> = {};
  for (const [kana, entry] of Object.entries(parts.entries ?? {})) {
    entries[key(kana)] = { box: 0, dueAt: 0, updatedAt: 1, ...entry };
  }
  const recent: Record<LearnKanaKey, readonly RecallAnswer[]> = {};
  for (const [kana, list] of Object.entries(parts.recent ?? {})) recent[key(kana)] = list;
  return {
    ...base,
    unlocked: {
      ...base.unlocked,
      hiragana: parts.unlocked ? parts.unlocked.map(key) : base.unlocked.hiragana,
    },
    entries,
    recent,
  };
}
