import { FSRS7_DEFAULT_WEIGHTS, FSRS7_MODEL_BOUNDS, FSRS7Algorithm } from 'ts-fsrs/models/fsrs-7';
import { describe, expect, it } from 'vitest';
import { FSRS7, FSRS7_WEIGHTS } from './fsrs7';
import type { Grade, Memory } from './memory';

// ts-fsrs 6.0.0 is a dev dependency of this package only: the reference the sim is checked against.

const MINUTE = 1 / 1440;

/** Answers as (grade, days since the previous one): learning steps, then reviews. */
const history: readonly (readonly [Grade, number])[] = [
  [3, 0.5 * MINUTE],
  [3, MINUTE],
  [1, 2 * MINUTE],
  [3, 0.5 * MINUTE],
  [2, 4 * MINUTE],
  [3, 0.45],
  [3, 0.5],
  [1, 3],
  [3, 10 * MINUTE],
  [4, 2],
  [2, 7.3],
  [3, 21],
];

describe('FSRS-7', () => {
  const reference = new FSRS7Algorithm([...FSRS7_DEFAULT_WEIGHTS], FSRS7_MODEL_BOUNDS);

  it('has the default weights of ts-fsrs 6.0.0', () => {
    expect(FSRS7_WEIGHTS).toEqual([...FSRS7_DEFAULT_WEIGHTS]);
  });

  for (const first of [1, 3] as const) {
    it(`matches ts-fsrs on a history that starts with grade ${first}`, () => {
      let ours: Memory = FSRS7.firstMemory(first);
      let theirs = reference.next_state(null, 0, first);
      for (const [step, [grade, elapsed]] of [[first, 0] as const, ...history].entries()) {
        if (step > 0) {
          expect(FSRS7.retrievability(ours, elapsed)).toBeCloseTo(
            reference.curve(elapsed, theirs).retrievability,
            6,
          );
          ours = FSRS7.nextMemory(ours, grade, elapsed);
          theirs = reference.next_state(theirs, elapsed, grade);
        }
        expect(ours.stability, `stability at step ${step}`).toBeCloseTo(theirs.stability, 5);
        expect(ours.fast, `fast at step ${step}`).toBeCloseTo(theirs.stabilityFast, 5);
        expect(ours.difficulty, `difficulty at step ${step}`).toBeCloseTo(theirs.difficulty, 5);
      }
    });
  }

  it('solves the interval as ts-fsrs does', () => {
    let m = FSRS7.firstMemory(1);
    let theirs = reference.next_state(null, 0, 1);
    for (const [grade, elapsed] of history) {
      m = FSRS7.nextMemory(m, grade, elapsed);
      theirs = reference.next_state(theirs, elapsed, grade);
      for (const retention of [0.8, 0.9, 0.95]) {
        const ours = FSRS7.intervalFor(m, retention);
        expect(FSRS7.retrievability(m, ours)).toBeCloseTo(retention, 6);
        expect(ours / reference.next_interval(theirs, retention)).toBeCloseTo(1, 2);
      }
    }
  });
});
