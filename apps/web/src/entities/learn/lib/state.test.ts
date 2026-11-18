import { describe, it, expect } from 'vitest';
import { mergeLearn } from '@nekotype/shared/runtime';
import { keyOf } from './tracks';
import { emptyDelta, initialLearnState, learnOrder, unlockDelta } from './state';

const A = keyOf('hiragana', 'あ');
const KA = keyOf('hiragana', 'か');

describe('unlockDelta', () => {
  it('is empty when nothing changed', () => {
    const state = initialLearnState();
    expect(unlockDelta(state, state)).toEqual(emptyDelta());
  });

  it('names the kana unlocked and the entries that moved, and merging it gives the later state', () => {
    const before = {
      ...initialLearnState(),
      entries: { [A]: { box: 0, dueAt: 0, updatedAt: 1 } as const },
    };
    const after = {
      ...before,
      unlocked: {
        ...before.unlocked,
        hiragana: [...before.unlocked.hiragana, KA],
      },
      entries: { [A]: { box: 1, dueAt: 5, updatedAt: 2 } as const },
    };
    const delta = unlockDelta(before, after);
    expect(delta.unlocked).toEqual({ hiragana: [KA], katakana: [] });
    expect(delta.entries).toEqual({ [A]: after.entries[A] });
    const merged = mergeLearn(before, delta, learnOrder());
    expect(merged.unlocked.hiragana).toContain(KA);
    expect(merged.entries).toEqual(after.entries);
  });
});
