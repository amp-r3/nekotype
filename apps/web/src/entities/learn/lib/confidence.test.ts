import { describe, it, expect } from 'vitest';
import type { RecallAnswer } from '@nekotype/shared/types';
import { accuracyOf, isConfident, medianAnswerMs } from './confidence';

function answers(times: readonly number[], wrong = 0): RecallAnswer[] {
  return times.map((ms, i) => ({ at: i + 1, ms, ok: i >= wrong }));
}
const flat = (ms: number, n = 10): number[] => Array.from({ length: n }, () => ms);

describe('isConfident (target 1500 ms)', () => {
  it('holds at a median of 1500 ms and not at 1501 ms', () => {
    expect(isConfident(answers(flat(1500)), 1500)).toBe(true);
    expect(isConfident(answers(flat(1501)), 1500)).toBe(false);
  });
  it('takes the mean of the two middle values for an even count', () => {
    // sorted: 1000 ×4, 1400, 1600, 2000 ×4 → middle values 1400 and 1600 → 1500
    expect(
      isConfident(answers([1000, 1000, 1000, 1000, 1400, 1600, 2000, 2000, 2000, 2000]), 1500),
    ).toBe(true);
  });
  it('needs 9 of 10 correct', () => {
    expect(isConfident(answers(flat(1000), 1), 1500)).toBe(true);
    expect(isConfident(answers(flat(1000), 2), 1500)).toBe(false);
  });
  it('needs 10 answers', () => {
    expect(isConfident(answers(flat(1000, 9)), 1500)).toBe(false);
  });
  it('applies a changed target at once', () => {
    const list = answers(flat(1800));
    expect(isConfident(list, 1500)).toBe(false);
    expect(isConfident(list, 2000)).toBe(true);
  });
});

describe('median and accuracy', () => {
  it('are computed over the answers', () => {
    const list = answers([1000, 2000, 3000, 4000], 1);
    expect(medianAnswerMs(list)).toBe(2500);
    expect(accuracyOf(list)).toBe(0.75);
  });
});
