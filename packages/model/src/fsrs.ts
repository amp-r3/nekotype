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

  // The parts of the formulas that do not depend on the memory, computed once: the fold calls
  // `nextMemory` for every answer. Each is the same expression, so the results are the same.
  const W6 = w(6);
  const W9 = w(9);
  const W10 = w(10);
  const W11 = w(11);
  const W12 = w(12);
  const W13 = w(13);
  const W14 = w(14);
  const W19 = w(19);
  const HARD = w(15);
  const EASY = w(16);
  const EXP_W8 = Math.exp(w(8));
  const LAPSE_DIVISOR = Math.exp(w(17) * w(18));
  /** `w7 × D0(4)` and `1 − w7` of the mean reversion. */
  const REVERT_TARGET = w(7) * initDifficulty(4);
  const REVERT_KEEP = 1 - w(7);
  /** The short-term factor `exp(w17 × (g − 3 + w18))` per grade. */
  const shortTerm = (g: Grade): number => Math.exp(w(17) * (g - 3 + w(18)));
  const SHORT_TERM: readonly [number, number, number, number, number] = [
    0,
    shortTerm(1),
    shortTerm(2),
    shortTerm(3),
    shortTerm(4),
  ];

  function nextDifficulty(d: number, g: Grade): number {
    const delta = -W6 * (g - 3);
    const next = d + (delta * (10 - d)) / 9;
    return clamp(REVERT_TARGET + REVERT_KEEP * next, 1, 10);
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
        const inc = s ** -W19 * SHORT_TERM[g];
        stability = s * (g >= 2 ? Math.max(inc, 1) : inc);
      } else {
        const r = retrievability(s, elapsed);
        if (g === 1) {
          const forget = W11 * d ** -W12 * ((s + 1) ** W13 - 1) * Math.exp((1 - r) * W14);
          stability = clamp(s / LAPSE_DIVISOR, S_MIN, forget);
        } else {
          const hard = g === 2 ? HARD : 1;
          const easy = g === 4 ? EASY : 1;
          stability =
            s * (1 + EXP_W8 * (11 - d) * s ** -W9 * (Math.exp((1 - r) * W10) - 1) * hard * easy);
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
