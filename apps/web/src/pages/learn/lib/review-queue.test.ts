import { describe, expect, it } from 'vitest';
import { dueCount, dueKeys, reviewQueue } from './review-queue';
import { answers, key, stateWith } from './test-util';
import { keysOfTrack } from '@/entities/learn';
import type { LearnState, RecallAnswer } from '@nekotype/shared/types';

const NOW = 10_000;
const TARGET = 1500;
const confident = answers(10, 900);

// Every listed kana has confident answers, so the entry alone decides whether it is due.
function confidentState(entries: Record<string, { box: 0 | 1 | 2; dueAt: number }>): LearnState {
  const recent: Record<string, readonly RecallAnswer[]> = {};
  for (const kana of Object.keys(entries)) recent[kana] = confident;
  return stateWith({ entries, recent });
}

describe('review queue', () => {
  it('lists due kana, oldest dueAt first', () => {
    const state = confidentState({
      あ: { box: 1, dueAt: 5000 },
      い: { box: 2, dueAt: 2000 },
      う: { box: 1, dueAt: 9000 },
      え: { box: 1, dueAt: NOW + 1 },
      お: { box: 0, dueAt: 0 },
    });
    expect(dueKeys(state, 'hiragana', TARGET, NOW)).toEqual([key('い'), key('あ'), key('う')]);
    expect(dueCount(state, 'hiragana', TARGET, NOW)).toBe(3);
  });

  it('leaves out a kana that lost its confidence: it is learning, not due (ADR 062)', () => {
    const state = stateWith({
      entries: { あ: { box: 2, dueAt: 1000 }, い: { box: 1, dueAt: 1000 } },
      recent: { あ: answers(10, 2400), い: confident },
    });
    expect(dueKeys(state, 'hiragana', TARGET, NOW)).toEqual([key('い')]);
    // A slower target makes あ confident again, and so due.
    expect(dueCount(state, 'hiragana', 2500, NOW)).toBe(2);
  });

  it('breaks ties in track order', () => {
    const state = confidentState({ う: { box: 1, dueAt: 1000 }, あ: { box: 1, dueAt: 1000 } });
    expect(dueKeys(state, 'hiragana', TARGET, NOW)).toEqual([key('あ'), key('う')]);
  });

  it('is empty when nothing is due', () => {
    expect(
      reviewQueue(confidentState({ あ: { box: 0, dueAt: 0 } }), 'hiragana', TARGET, NOW),
    ).toEqual([]);
  });

  it('ignores the other track', () => {
    const base = stateWith({});
    const state: LearnState = {
      ...base,
      entries: { 'katakana:ア': { box: 1, dueAt: 1, updatedAt: 1 } },
      recent: { 'katakana:ア': confident },
    };
    expect(dueCount(state, 'hiragana', TARGET, NOW)).toBe(0);
    expect(dueCount(state, 'katakana', TARGET, NOW)).toBe(1);
  });

  it('keeps at most 20 tasks while N counts all due kana', () => {
    const keys = keysOfTrack('hiragana').slice(0, 30);
    const base = stateWith({});
    const state: LearnState = {
      ...base,
      entries: Object.fromEntries(
        keys.map((k, i) => [k, { box: 1, dueAt: 100 + i, updatedAt: 1 }] as const),
      ),
      recent: Object.fromEntries(keys.map((k) => [k, confident] as const)),
    };
    expect(dueCount(state, 'hiragana', TARGET, NOW)).toBe(30);
    const queue = reviewQueue(state, 'hiragana', TARGET, NOW);
    expect(queue).toHaveLength(20);
    expect(queue[0]).toBe(keys[0]);
  });
});
