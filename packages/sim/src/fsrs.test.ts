import { describe, expect, it } from 'vitest';
import { firstMemory, nextMemory, retrievability } from './fsrs';
import type { Grade, Memory } from './fsrs';

// Expected values computed once with FSRS6Algorithm of ts-fsrs 6.0.0 and its default weights.
const steps: readonly (readonly [string, Grade, number, readonly [number, number]])[] = [
  ['same day good', 3, 0, [2.11121424, 2.3065]],
  ['good after 2 days', 3, 2, [2.1043314, 10.97104786]],
  ['again after 10 days', 1, 10, [7.38997579, 1.52281067]],
  ['same day again', 1, 0, [9.12733116, 0.52590276]],
  ['hard after 3 days', 2, 3, [9.40591013, 1.47948875]],
  ['easy after 5 days', 4, 5, [9.19262135, 6.16818765]],
];

describe('FSRS-6', () => {
  it('matches ts-fsrs on a sequence of reviews', () => {
    let m: Memory = firstMemory(3);
    expect(m.difficulty).toBeCloseTo(2.11810397, 6);
    expect(m.stability).toBeCloseTo(2.3065, 6);
    for (const [name, grade, elapsed, [d, s]] of steps) {
      m = nextMemory(m, grade, elapsed, elapsed === 0);
      expect(m.difficulty, name).toBeCloseTo(d, 5);
      expect(m.stability, name).toBeCloseTo(s, 5);
    }
  });

  it('is 90% recalled after one stability', () => {
    expect(retrievability(4, 4)).toBeCloseTo(0.9, 6);
    expect(retrievability(2, 3)).toBeCloseTo(0.86982531, 6);
  });
});
