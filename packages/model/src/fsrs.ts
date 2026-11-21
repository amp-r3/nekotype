/**
 * FSRS-6 with its default parameters, written from the formulas of ts-fsrs 6.0.0 (MIT) and
 * https://github.com/open-spaced-repetition/awesome-fsrs/wiki/The-Algorithm#fsrs-6. Times are in
 * days. A review on the same calendar day as the previous one uses the short-term formula.
 */

export const FSRS6_WEIGHTS: readonly number[] = [
  0.212, 1.2931, 2.3065, 8.2956, 6.4133, 0.8334, 3.0194, 0.001, 1.8722, 0.1666, 0.796, 1.4835,
  0.0614, 0.2629, 1.6483, 0.6014, 1.8729, 0.5425, 0.0912, 0.0658, 0.1542,
];

/** 1 again, 2 hard, 3 good, 4 easy (easy is never given by the model, D4). */
export type Grade = 1 | 2 | 3 | 4;

export type Memory = { readonly stability: number; readonly difficulty: number };

const S_MIN = 0.001;
const S_MAX = 36500;

function clamp(x: number, lo: number, hi: number): number {
  return Math.min(hi, Math.max(lo, x));
}

/** The FSRS-6 formulas for a set of 21 weights. */
export interface Fsrs {
  /** Probability of recall `elapsed` days after the last review. */
  readonly retrievability: (stability: number, elapsed: number) => number;
  /** Days until retrievability falls to `retention`. */
  readonly intervalFor: (stability: number, retention: number) => number;
  /** The memory after the first answer to a new item. */
  readonly firstMemory: (g: Grade) => Memory;
  /**
   * The memory after a review `elapsed` days after the previous one; `sameDay` selects the
   * short-term formula.
   */
  readonly nextMemory: (m: Memory, g: Grade, elapsed: number, sameDay: boolean) => Memory;
}

export function createFsrs(weights: readonly number[]): Fsrs {
  const w = (i: number): number => weights[i] ?? 0;
  const DECAY = -w(20);
  const FACTOR = 0.9 ** (1 / DECAY) - 1;

  const retrievability = (stability: number, elapsed: number): number =>
    (1 + (FACTOR * Math.max(0, elapsed)) / stability) ** DECAY;

  const initDifficulty = (g: Grade): number => w(4) - Math.exp((g - 1) * w(5)) + 1;

  function nextDifficulty(d: number, g: Grade): number {
    const delta = -w(6) * (g - 3);
    const next = d + (delta * (10 - d)) / 9;
    return clamp(w(7) * initDifficulty(4) + (1 - w(7)) * next, 1, 10);
  }

  return {
    retrievability,
    intervalFor: (stability, retention) => (stability / FACTOR) * (retention ** (1 / DECAY) - 1),
    firstMemory: (g) => ({
      difficulty: clamp(initDifficulty(g), 1, 10),
      stability: clamp(w(g - 1), S_MIN, S_MAX),
    }),
    nextMemory: (m, g, elapsed, sameDay) => {
      const { difficulty: d, stability: s } = m;
      let stability: number;
      if (sameDay) {
        const inc = s ** -w(19) * Math.exp(w(17) * (g - 3 + w(18)));
        stability = s * (g >= 2 ? Math.max(inc, 1) : inc);
      } else {
        const r = retrievability(s, elapsed);
        if (g === 1) {
          const forget = w(11) * d ** -w(12) * ((s + 1) ** w(13) - 1) * Math.exp((1 - r) * w(14));
          stability = clamp(s / Math.exp(w(17) * w(18)), S_MIN, forget);
        } else {
          const hard = g === 2 ? w(15) : 1;
          const easy = g === 4 ? w(16) : 1;
          stability =
            s *
            (1 +
              Math.exp(w(8)) *
                (11 - d) *
                s ** -w(9) *
                (Math.exp((1 - r) * w(10)) - 1) *
                hard *
                easy);
        }
      }
      return { difficulty: nextDifficulty(d, g), stability: clamp(stability, S_MIN, S_MAX) };
    },
  };
}

/** FSRS-6 with the default weights. */
export const { retrievability, intervalFor, firstMemory, nextMemory } = createFsrs(FSRS6_WEIGHTS);

/** Days per day of stability until recall falls to `retention`: `intervalFor(1, retention)`. */
export function intervalFactor(retention: number): number {
  return intervalFor(1, retention);
}
