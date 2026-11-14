import { describe, it, expect } from 'vitest';
import type { TestResult } from '@nekotype/shared/types';
import { dayStart, localDay } from '@/entities/learn';
import { defaultMode, figures, modesOf, oneMode, select } from './selection';

const TODAY = localDay(new Date(2026, 5, 15, 12).getTime());
const HOUR = 3_600_000;

function result(id: string, patch: Partial<TestResult> = {}): TestResult {
  return {
    id,
    content: 'words',
    script: 'hiragana',
    strictness: 'learner',
    config: { kind: 'time', seconds: 60 },
    endReason: 'complete',
    repeated: false,
    startedAt: 0,
    endedAt: dayStart(TODAY) + 12 * HOUR,
    durationMs: 60_000,
    tokens: 100,
    erroredTokens: 5,
    items: 20,
    keystrokes: 150,
    rejectedKeystrokes: 6,
    assisted: 0,
    kpm: 100,
    kanaAccuracy: 0.95,
    celebratedPersonalBest: false,
    contentVersion: 'c',
    appVersion: 'a',
    ...patch,
  };
}

const W60 = 'words|hiragana|learner|time:60';
const P25 = 'phrases|hiragana|learner|count:25';
const phrases = { content: 'phrases', config: { kind: 'count', prompts: 25 } } as const;
const all = { mode: 'all', period: 'all', repeats: true } as const;

describe('modesOf (S3)', () => {
  it('lists the modes, most results first, ties by label', () => {
    const results = [
      result('1', phrases),
      result('2'),
      result('3'),
      result('4', { config: { kind: 'zen' } }),
    ];
    const modes = modesOf(results, (key) => key);
    expect(modes.map((m) => [m.key, m.count])).toEqual([
      [W60, 2],
      [P25, 1],
      ['words|hiragana|learner|zen', 1],
    ]);
  });
});

describe('defaultMode', () => {
  it('is the mode of the newest result', () => {
    const results = [result('1', { endedAt: 1 }), result('2', { ...phrases, endedAt: 2 })];
    expect(defaultMode(results)).toBe(P25);
  });

  it('is all without results', () => {
    expect(defaultMode([])).toBe('all');
  });
});

describe('select (S4)', () => {
  const at = (daysBack: number, hour: number): number => dayStart(TODAY - daysBack) + hour * HOUR;
  // Oldest first, as the store gives them.
  const results = [
    result('out30', { endedAt: at(30, 23) }),
    result('in30', { endedAt: at(29, 0) }),
    result('out7', { endedAt: at(7, 23) + 59 * 60_000 }),
    result('in7', { endedAt: at(6, 23) + 59 * 60_000 }),
  ];

  it('keeps whole local days: today and the six days before', () => {
    const ids = select(results, { ...all, period: '7' }, TODAY).map((r) => r.id);
    expect(ids).toEqual(['in7']);
  });

  it('keeps 30 days, and every day for all', () => {
    expect(select(results, { ...all, period: '30' }, TODAY).map((r) => r.id)).toEqual([
      'in30',
      'out7',
      'in7',
    ]);
    expect(select(results, all, TODAY)).toHaveLength(4);
  });

  it('keeps the order of its input, oldest first', () => {
    expect(select(results, all, TODAY).map((r) => r.id)).toEqual(['out30', 'in30', 'out7', 'in7']);
  });

  it('filters by mode', () => {
    const mixed = [result('a'), result('b', phrases)];
    expect(select(mixed, { ...all, mode: P25 }, TODAY).map((r) => r.id)).toEqual(['b']);
  });

  it('leaves repeats out unless asked', () => {
    const mixed = [result('a'), result('b', { repeated: true })];
    expect(select(mixed, { ...all, repeats: false }, TODAY).map((r) => r.id)).toEqual(['a']);
    expect(select(mixed, all, TODAY)).toHaveLength(2);
  });
});

describe('figures', () => {
  it('counts every test and takes the KPM of those that are not repeats', () => {
    const selection = [
      result('1', { kpm: 60, kanaAccuracy: 0.9 }),
      result('2', { kpm: 80, kanaAccuracy: 1 }),
      result('3', { kpm: 200, kanaAccuracy: 0.8, repeated: true }),
    ];
    expect(figures(selection, true)).toEqual({
      tests: 3,
      accuracy: 90,
      medianKpm: 70,
      bestKpm: 80,
    });
  });

  it('has no KPM figures for mixed modes or without tests that are not repeats', () => {
    expect(figures([result('1')], false)).toMatchObject({ medianKpm: null, bestKpm: null });
    expect(figures([result('1', { repeated: true })], true)).toMatchObject({
      medianKpm: null,
      bestKpm: null,
    });
  });
});

describe('oneMode', () => {
  it('is false for no results', () => {
    expect(oneMode([])).toBe(false);
  });

  it('is true when all results share one key', () => {
    expect(oneMode([result('1')])).toBe(true);
    expect(oneMode([result('1'), result('2', { repeated: true })])).toBe(true);
  });

  it('is false for two keys', () => {
    expect(oneMode([result('1'), result('2', phrases)])).toBe(false);
  });
});
