import type { LearnKanaKey } from '@nekotype/shared/types';
import { describe, expect, it } from 'vitest';
import { createFold } from './fold';
import type { ItemState } from './fold';
import { strongerSince } from './stronger';
import type { LogStats } from './stats';
import { describe as describeState } from './view';

const KA = 'hiragana:か';
const KI = 'hiragana:き';
const KATA_KA = 'katakana:カ';
const STATS: LogStats = {
  kana: new Map(),
  days: new Map(),
  started: 0,
  finished: 0,
  introducedIn: new Map(),
};

function viewOf(entries: [LearnKanaKey, ItemState['phase'], number][]) {
  const items = new Map<LearnKanaKey, ItemState>(
    entries.map(([key, phase, stability]) => [
      key,
      {
        phase,
        memory: { stability, difficulty: 5 },
        lastAt: 0,
        lastDay: 0,
        streak: 0,
        lastTask: 0,
      },
    ]),
  );
  return describeState({ ...createFold({ targetMs: 1500, stats: false }).state, items }, STATS);
}

describe('strongerSince', () => {
  it('lists kana whose chart state rose, in track order', () => {
    const before = viewOf([
      [KA, 'learning', 1],
      [KATA_KA, 'learned', 5],
    ]);
    const after = viewOf([
      [KA, 'learned', 3],
      [KI, 'learning', 1],
      [KATA_KA, 'learned', 25],
    ]);
    expect(strongerSince(before, after)).toEqual([
      { key: KA, from: 'learning', to: 'learned' },
      { key: KI, from: 'locked', to: 'learning' },
      { key: KATA_KA, from: 'learned', to: 'mastered' },
    ]);
  });

  it('lists a learned or mastered kana whose stability at least doubled', () => {
    const before = viewOf([
      [KA, 'learned', 4],
      [KI, 'learned', 4],
      [KATA_KA, 'learned', 22],
    ]);
    const after = viewOf([
      [KA, 'learned', 8],
      [KI, 'learned', 7.99],
      [KATA_KA, 'learned', 45],
    ]);
    expect(strongerSince(before, after)).toEqual([
      { key: KA, from: 'learned', to: 'learned' },
      { key: KATA_KA, from: 'mastered', to: 'mastered' },
    ]);
  });

  it('says nothing of a kana that fell back or did not change', () => {
    const before = viewOf([
      [KA, 'learned', 10],
      [KI, 'learning', 1],
    ]);
    const after = viewOf([
      [KA, 'learning', 2],
      [KI, 'learning', 1],
    ]);
    expect(strongerSince(before, after)).toEqual([]);
    expect(strongerSince(after, after)).toEqual([]);
  });
});
