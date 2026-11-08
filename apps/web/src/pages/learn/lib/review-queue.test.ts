import { describe, expect, it } from 'vitest';
import { dueCount, dueKeys, reviewQueue } from './review-queue';
import { key, stateWith } from './test-util';
import { keysOfTrack } from '@/entities/learn';
import type { LearnState } from '@nekotype/shared/types';

const NOW = 10_000;

describe('review queue', () => {
  it('lists due kana, oldest dueAt first', () => {
    const state = stateWith({
      entries: {
        あ: { box: 1, dueAt: 5000 },
        い: { box: 2, dueAt: 2000 },
        う: { box: 1, dueAt: 9000 },
        え: { box: 1, dueAt: NOW + 1 },
        お: { box: 0, dueAt: 0 },
      },
    });
    expect(dueKeys(state, 'hiragana', NOW)).toEqual([key('い'), key('あ'), key('う')]);
    expect(dueCount(state, 'hiragana', NOW)).toBe(3);
  });

  it('breaks ties in track order', () => {
    const state = stateWith({
      entries: { う: { box: 1, dueAt: 1000 }, あ: { box: 1, dueAt: 1000 } },
    });
    expect(dueKeys(state, 'hiragana', NOW)).toEqual([key('あ'), key('う')]);
  });

  it('is empty when nothing is due', () => {
    expect(reviewQueue(stateWith({ entries: { あ: { box: 0 } } }), 'hiragana', NOW)).toEqual([]);
  });

  it('ignores the other track', () => {
    const base = stateWith({});
    const state: LearnState = {
      ...base,
      entries: { 'katakana:ア': { box: 1, dueAt: 1, updatedAt: 1 } },
    };
    expect(dueCount(state, 'hiragana', NOW)).toBe(0);
    expect(dueCount(state, 'katakana', NOW)).toBe(1);
  });

  it('keeps at most 20 tasks while N counts all due kana', () => {
    const keys = keysOfTrack('hiragana').slice(0, 30);
    const base = stateWith({});
    const state: LearnState = {
      ...base,
      entries: Object.fromEntries(
        keys.map((k, i) => [k, { box: 1, dueAt: 100 + i, updatedAt: 1 }] as const),
      ),
    };
    expect(dueCount(state, 'hiragana', NOW)).toBe(30);
    const queue = reviewQueue(state, 'hiragana', NOW);
    expect(queue).toHaveLength(20);
    expect(queue[0]).toBe(keys[0]);
  });
});
