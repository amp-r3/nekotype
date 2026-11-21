/**
 * FSRS-6 with its default parameters, written from the formulas of ts-fsrs 6.0.0 (MIT) and
 * https://github.com/open-spaced-repetition/awesome-fsrs/wiki/The-Algorithm#fsrs-6. Times are in
 * days. A review on the same calendar day as the previous one uses the short-term formula.
 */

export const FSRS6_WEIGHTS: readonly number[] = [
  0.212, 1.2931, 2.3065, 8.2956, 6.4133, 0.8334, 3.0194, 0.001, 1.8722, 0.1666, 0.796, 1.4835,
  0.0614, 0.2629, 1.6483, 0.6014, 1.8729, 0.5425, 0.0912, 0.0658, 0.1542,
];

/** 1 again, 2 hard, 3 good, 4 easy. */
export type Grade = 1 | 2 | 3 | 4;

export interface Memory {
  readonly difficulty: number;
  readonly stability: number;
}

const S_MIN = 0.001;
const S_MAX = 36500;

function w(i: number): number {
  return FSRS6_WEIGHTS[i] ?? 0;
}

function clamp(x: number, lo: number, hi: number): number {
  return Math.min(hi, Math.max(lo, x));
}

const DECAY = -w(20);
const FACTOR = 0.9 ** (1 / DECAY) - 1;

/** Probability of recall `elapsed` days after the last review. */
export function retrievability(stability: number, elapsed: number): number {
  return (1 + (FACTOR * Math.max(0, elapsed)) / stability) ** DECAY;
}

/** Days until retrievability falls to `retention`. */
export function intervalFor(stability: number, retention: number): number {
  return (stability / FACTOR) * (retention ** (1 / DECAY) - 1);
}

function initDifficulty(g: Grade): number {
  return w(4) - Math.exp((g - 1) * w(5)) + 1;
}

function nextDifficulty(d: number, g: Grade): number {
  const delta = -w(6) * (g - 3);
  const next = d + (delta * (10 - d)) / 9;
  return clamp(w(7) * initDifficulty(4) + (1 - w(7)) * next, 1, 10);
}

/** The memory after the first answer to a new item. */
export function firstMemory(g: Grade): Memory {
  return { difficulty: clamp(initDifficulty(g), 1, 10), stability: clamp(w(g - 1), S_MIN, S_MAX) };
}

/**
 * The memory after a review `elapsed` days after the previous one; `sameDay` selects the
 * short-term formula.
 */
export function nextMemory(m: Memory, g: Grade, elapsed: number, sameDay: boolean): Memory {
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
          Math.exp(w(8)) * (11 - d) * s ** -w(9) * (Math.exp((1 - r) * w(10)) - 1) * hard * easy);
    }
  }
  return { difficulty: nextDifficulty(d, g), stability: clamp(stability, S_MIN, S_MAX) };
}
