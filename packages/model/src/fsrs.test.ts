import { FSRS6_DEFAULT_WEIGHTS, FSRS6_MODEL_BOUNDS, FSRS6Algorithm } from 'ts-fsrs/models/fsrs-6';
import { describe, expect, it } from 'vitest';
import {
  FSRS6_WEIGHTS,
  firstMemory,
  intervalFactor,
  intervalFor,
  nextMemory,
  retrievability,
} from './fsrs';
import type { Grade, Memory } from './fsrs';

// ts-fsrs 6.0.0 is a dev dependency of this package only: the reference the model is checked
// against. Its FSRS-6 model entry uses the short-term formula exactly when `elapsed = 0`.
const reference = (): FSRS6Algorithm =>
  new FSRS6Algorithm([...FSRS6_DEFAULT_WEIGHTS], true, FSRS6_MODEL_BOUNDS);

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

/** The six steps of the first history, with same-day steps (`elapsed = 0`) among them. */
const steps: readonly (readonly [Grade, number])[] = [
  [3, 0],
  [3, 2],
  [1, 10],
  [1, 0],
  [2, 3],
  [4, 5],
];

// ts-fsrs rounds the recall probability to 8 digits before it uses it. In a minutes-long step
// (1 − recall about 2e-5) that moves the new stability by about 4e-7 a step, so the history with
// minute gaps agrees to 5 digits and no better; the steps with day gaps agree to 6.
function expectSame(
  ours: Memory,
  theirs: { stability: number; difficulty: number },
  at: string,
  digits = 6,
) {
  expect(ours.stability, `stability ${at}`).toBeCloseTo(theirs.stability, digits);
  expect(ours.difficulty, `difficulty ${at}`).toBeCloseTo(theirs.difficulty, digits);
}

describe('FSRS-6 against ts-fsrs 6.0.0', () => {
  it('has the default weights of ts-fsrs', () => {
    expect(FSRS6_WEIGHTS).toEqual([...FSRS6_DEFAULT_WEIGHTS]);
  });

  it('matches on the six steps with same-day reviews', () => {
    const algorithm = reference();
    let ours = firstMemory(3);
    let theirs = algorithm.next_state(null, 0, 3);
    expectSame(ours, theirs, 'first');
    for (const [grade, elapsed] of steps) {
      ours = nextMemory(ours, grade, elapsed, elapsed === 0);
      theirs = algorithm.next_state(theirs, elapsed, grade);
      expectSame(ours, theirs, `grade ${grade} after ${elapsed} d`);
    }
  });

  for (const first of [1, 3] as const) {
    it(`matches on the long history that starts with grade ${first}`, () => {
      const algorithm = reference();
      let ours = firstMemory(first);
      let theirs = algorithm.next_state(null, 0, first);
      expectSame(ours, theirs, 'first');
      for (const [step, [grade, elapsed]] of history.entries()) {
        ours = nextMemory(ours, grade, elapsed, elapsed === 0);
        theirs = algorithm.next_state(theirs, elapsed, grade);
        expectSame(ours, theirs, `step ${step}`, 5);
        expect(retrievability(ours.stability, elapsed), `recall ${step}`).toBeCloseTo(
          algorithm.forgetting_curve(elapsed, theirs.stability),
          6,
        );
      }
    });
  }

  it('is 90% recalled after one stability', () => {
    expect(retrievability(4, 4)).toBeCloseTo(0.9, 6);
    expect(retrievability(2, 3)).toBeCloseTo(0.86982531, 6);
  });

  it('gives intervalFactor as the interval of a unit stability', () => {
    for (const retention of [0.8, 0.9, 0.93, 0.98]) {
      expect(intervalFactor(retention)).toBe(intervalFor(1, retention));
      expect(retrievability(1, intervalFactor(retention))).toBeCloseTo(retention, 9);
    }
    expect(intervalFor(10, 0.9)).toBeCloseTo(10, 6);
  });
});
