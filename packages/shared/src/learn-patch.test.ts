import { describe, it, expect } from 'vitest';
import {
  addBuckets,
  mergeRecent,
  patchBuckets,
  patchRecent,
  splitLearnDelta,
  touchedKeys,
} from './runtime';
import { isLearnKanaKey } from './runtime';
import { applyMergePatch, intIn, seededRng } from './testing';
import type { DayBuckets, LearnDelta, LearnKanaKey, RecallAnswer, Rng } from './types';

const CASES = 500;
const KANA: readonly LearnKanaKey[] = [
  'hiragana:あ',
  'hiragana:い',
  'hiragana:う',
  'hiragana:え',
  'katakana:ア',
  'katakana:イ',
  'katakana:ウ',
  'katakana:エ',
];

function pickKeys<T>(
  source: Readonly<Record<string, T>>,
  keys: readonly string[],
): Record<string, T> {
  const out: Record<string, T> = {};
  for (const key of keys) {
    const value = source[key];
    if (value !== undefined) out[key] = value;
  }
  return out;
}

function answers(rng: Rng, max: number): RecallAnswer[] {
  const list: RecallAnswer[] = [];
  const count = intIn(rng, 1, max);
  for (let i = 0; i < count; i += 1) {
    list.push({ at: intIn(rng, 1, 40), ms: intIn(rng, 5, 30) * 100, ok: rng.next() > 0.5 });
  }
  return list.sort((a, b) => a.at - b.at);
}

function recentMap(rng: Rng, max: number): Record<LearnKanaKey, RecallAnswer[]> {
  const map: Record<string, RecallAnswer[]> = {};
  for (const key of KANA) if (rng.next() < 0.5) map[key] = answers(rng, max);
  return map;
}

function days(rng: Rng, from: number, to: number, density: number): DayBuckets {
  const out: Record<string, Record<string, number>> = {};
  for (let day = from; day <= to; day += 1) {
    if (rng.next() > density) continue;
    const buckets: Record<string, number> = {};
    for (let i = intIn(rng, 0, 4); i > 0; i -= 1)
      buckets[String(intIn(rng, 0, 100))] = intIn(rng, 1, 9);
    out[String(day)] = buckets;
  }
  return out;
}

function learnDelta(rng: Rng): LearnDelta {
  const recent = recentMap(rng, 10);
  const entries: Record<string, { box: 1; dueAt: number; updatedAt: number }> = {};
  const stats: Record<
    string,
    { recognitions: number; recognitionErrors: number; mixups: Record<string, number> }
  > = {};
  for (const key of KANA) {
    if (rng.next() < 0.6)
      entries[key] = { box: 1, dueAt: intIn(rng, 0, 99), updatedAt: intIn(rng, 0, 99) };
    if (rng.next() < 0.6)
      stats[key] = { recognitions: intIn(rng, 1, 5), recognitionErrors: 0, mixups: {} };
  }
  return {
    entries,
    unlocked: { hiragana: ['hiragana:あ'], katakana: [] },
    recent,
    stats,
    activeDays: [[intIn(rng, 1, 5), intIn(rng, 6, 9)]],
    recallBuckets: {
      hiragana: days(rng, 300, 420, 0.3),
      katakana: days(rng, 250, 380, 0.3),
    },
  };
}

function newestOf(stored: DayBuckets): number | null {
  const keys = Object.keys(stored).map(Number);
  return keys.length === 0 ? null : Math.max(...keys);
}

function eachCase(check: (rng: Rng, seed: number) => void): void {
  for (let seed = 1; seed <= CASES; seed += 1) {
    try {
      check(seededRng(seed), seed);
    } catch (error) {
      throw new Error(`failing seed ${seed}: ${String(error)}`, { cause: error });
    }
  }
}

describe('touchedKeys', () => {
  it('lists the kana of recent and the days of both tracks', () => {
    const delta = learnDelta(seededRng(7));
    const touched = touchedKeys(delta);
    expect(touched.kana).toEqual(Object.keys(delta.recent));
    expect(touched.days.hiragana).toEqual(Object.keys(delta.recallBuckets.hiragana));
    expect(touched.days.katakana).toEqual(Object.keys(delta.recallBuckets.katakana));
  });
});

describe('patchRecent', () => {
  it('applied as a merge patch gives the full merge, over generated cases', () => {
    eachCase((rng) => {
      const stored = recentMap(rng, 10);
      const delta = recentMap(rng, 10);
      const patch = patchRecent(pickKeys(stored, Object.keys(delta)), delta);
      const expected: Record<string, RecallAnswer[]> = { ...stored };
      for (const key of Object.keys(delta).filter(isLearnKanaKey)) {
        expected[key] = mergeRecent(stored[key] ?? [], delta[key] ?? []);
      }
      expect(applyMergePatch(stored, patch)).toEqual(expected);
    });
  });
});

describe('patchBuckets', () => {
  it('applied as a merge patch gives addBuckets, drops included, over generated cases', () => {
    eachCase((rng) => {
      const stored = days(rng, 40, 400, 0.4); // a stored track holds no day older than 365 before its newest
      const delta = days(rng, 300, 520, 0.3);
      const { patch } = patchBuckets(pickKeys(stored, Object.keys(delta)), newestOf(stored), delta);
      expect(applyMergePatch(stored, patch)).toEqual(addBuckets(stored, delta));
    });
  });

  it('deletes with null the day that is 366 days behind and keeps the one 365 behind', () => {
    const { patch, newest } = patchBuckets({}, 11, { '376': { '2': 2 } });
    expect(newest).toBe(376);
    // The window of 376 starts at 11: day 11 stays, the days below it (stored: 11 - 365 and up) go.
    expect(patch['376']).toEqual({ '2': 2 });
    expect(patch['11']).toBeUndefined();
    expect(patch['10']).toBeNull();
    expect(Object.keys(patch)).toHaveLength(1 + 365);
    // The patch never names more than 366 days of the stored window, however far the gap.
    const far = patchBuckets({}, 11, { '5000': { '2': 2 } }).patch;
    expect(Object.keys(far)).toHaveLength(1 + 366);
  });
});

describe('splitLearnDelta', () => {
  const caps = { kana: 3, days: 4 };

  it('respects the caps and keeps everything: head and rest are disjoint and their union is the delta', () => {
    eachCase((rng) => {
      const delta = learnDelta(rng);
      const { head, rest } = splitLearnDelta(delta, caps);
      const kana = (d: LearnDelta) =>
        new Set([...Object.keys(d.entries), ...Object.keys(d.recent), ...Object.keys(d.stats)]);
      expect(kana(head).size).toBeLessThanOrEqual(caps.kana);
      for (const key of kana(head)) expect(kana(rest).has(key)).toBe(false);
      for (const track of ['hiragana', 'katakana'] as const) {
        expect(Object.keys(head.recallBuckets[track]).length).toBeLessThanOrEqual(caps.days);
        expect({ ...head.recallBuckets[track], ...rest.recallBuckets[track] }).toEqual(
          delta.recallBuckets[track],
        );
        const headDays = Object.keys(head.recallBuckets[track]).map(Number);
        const restDays = Object.keys(rest.recallBuckets[track]).map(Number);
        if (headDays.length > 0 && restDays.length > 0) {
          expect(Math.max(...headDays)).toBeLessThan(Math.min(...restDays));
        }
      }
      expect({ ...head.entries, ...rest.entries }).toEqual(delta.entries);
      expect({ ...head.recent, ...rest.recent }).toEqual(delta.recent);
      expect({ ...head.stats, ...rest.stats }).toEqual(delta.stats);
      expect(head.unlocked).toEqual(delta.unlocked);
      expect(head.activeDays).toEqual(delta.activeDays);
      expect(rest.unlocked).toEqual({ hiragana: [], katakana: [] });
      expect(rest.activeDays).toEqual([]);
    });
  });

  it('applying head then rest equals applying the delta', () => {
    eachCase((rng) => {
      const stored = days(rng, 0, 420, 0.4);
      const delta = learnDelta(rng);
      const { head, rest } = splitLearnDelta(delta, caps);
      const track = 'hiragana';
      expect(
        addBuckets(addBuckets(stored, head.recallBuckets[track]), rest.recallBuckets[track]),
      ).toEqual(addBuckets(stored, delta.recallBuckets[track]));
      const recent = recentMap(rng, 10);
      const viaSplit = { ...recent };
      for (const part of [head, rest]) {
        for (const key of Object.keys(part.recent).filter(isLearnKanaKey)) {
          viaSplit[key] = mergeRecent(viaSplit[key] ?? [], part.recent[key] ?? []);
        }
      }
      const whole = { ...recent };
      for (const key of Object.keys(delta.recent).filter(isLearnKanaKey)) {
        whole[key] = mergeRecent(whole[key] ?? [], delta.recent[key] ?? []);
      }
      expect(viaSplit).toEqual(whole);
    });
  });

  it('leaves a delta within the caps whole in head', () => {
    const delta = learnDelta(seededRng(5));
    const { head, rest } = splitLearnDelta(delta, { kana: 99, days: 999 });
    expect(head).toEqual(delta);
    expect(Object.keys(rest.recent)).toHaveLength(0);
  });
});
