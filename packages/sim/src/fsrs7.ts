import type { Grade, Memory } from './fsrs';

/**
 * FSRS-7 with its default parameters, written from `FSRS7Algorithm` of ts-fsrs 6.0.0 (MIT), itself
 * a port of `model_v7.rs` of the fsrs crate 7.0.0 (BSD-3-Clause). Times are fractional days.
 *
 * - The memory has two traces: the slow `stability` and the fast `fast` (ts-fsrs `stabilityFast`).
 *   Both are updated by every answer with the same formula and their own weights (w7–w14 and
 *   w15–w22); a lapse caps the fast one at 0.8 of the slow one.
 * - Recall is a mixture of two power curves, one per trace (w23–w33); the weight of the fast trace
 *   falls as it grows, the slow one depends on the difficulty. Neither is `0.9` at `t = stability`,
 *   so the time to 90% recall (`s90`) is solved numerically.
 * - There is no separate same-day formula: a review 30 seconds after the previous one is the same
 *   formula with a small elapsed time.
 * - Unlike ts-fsrs, values are not rounded to 8 decimals.
 */

export const FSRS7_WEIGHTS: readonly number[] = [
  0.1104, 2.2395, 3.9221, 11.7841, 6.1686, 0.6457, 3.6807, 1.9795, 0, 1.3826, 0.7024, 0.5999,
  0.8146, 0.6398, 1, 1.3207, 0.6707, 3.8668, 0.4416, 0.0934, 1.8631, 0.6162, 1.0869, 0.1567, 0.0801,
  0.2421, 0.9464, 0.1433, 0.7145, 0, 0.5667, 0.3734, 0.5333, 0.3048,
];

const S_MIN = 1e-4;
const S_MAX = 36500;

function clamp(x: number, lo: number, hi: number): number {
  return Math.min(hi, Math.max(lo, x));
}

export interface Fsrs7 {
  /** Probability of recall `elapsed` days after the last answer. */
  readonly retrievability: (m: Memory, elapsed: number) => number;
  /** Days until the recall falls to `retention`. */
  readonly intervalFor: (m: Memory, retention: number) => number;
  readonly firstMemory: (g: Grade) => Memory;
  readonly nextMemory: (m: Memory, g: Grade, elapsed: number) => Memory;
}

export function createFsrs7(weights: readonly number[]): Fsrs7 {
  const w = (i: number): number => weights[i] ?? 0;
  const initDifficulty = (g: Grade): number => w(4) - Math.exp(w(5) * (g - 1)) + 1;

  function fastTrace(sFast: number): { decay: number; scale: number } {
    const decay = -clamp(w(23) * sFast ** (w(33) - 0.3), 0.01, 0.95);
    return { decay, scale: (Math.exp(Math.min(Math.log(w(25)) / decay, 60)) - 1) / sFast };
  }

  const fastRecall = (sFast: number, t: number): number => {
    const { decay, scale } = fastTrace(sFast);
    return (1 + scale * Math.max(0, t)) ** decay;
  };

  function retrievability(m: Memory, elapsed: number): number {
    const s = clamp(m.stability, S_MIN, S_MAX);
    const sFast = clamp(m.fast ?? m.stability, S_MIN, S_MAX);
    const d = clamp(m.difficulty, 1, 10);
    const decay = -clamp(w(24), 0.01, 0.95);
    const scale = ((w(26) ** (1 / decay) - 1) * Math.exp((d - 5) * (w(32) - 0.3))) / s;
    const weightFast = w(27) * sFast ** -w(29);
    const weightSlow = w(28) * s ** w(30) * Math.exp((d - 5) * (w(31) - 0.5));
    const t = Math.max(0, elapsed);
    const slow = (1 + scale * t) ** decay;
    const mix = (weightFast * fastRecall(sFast, t) + weightSlow * slow) / (weightFast + weightSlow);
    return mix * 0.99998 + 1e-5;
  }

  /** The new stability of one trace whose weights start at `start`. */
  function nextStability(s: number, d: number, r: number, g: Grade, start: number): number {
    const fail = w(start + 3) * ((s + 1) ** w(start + 4) - 1) * Math.exp((1 - r) * w(start + 5));
    const keep = Math.min(s, fail);
    if (g === 1) return keep;
    const hard = g === 2 ? w(start + 6) : 1;
    const easy = g === 4 ? w(start + 7) : 1;
    const inc =
      Math.exp(w(start) - 1.5) *
        (11 - d) *
        s ** -w(start + 1) *
        (Math.exp((1 - r) * w(start + 2)) - 1) *
        hard *
        easy +
      1;
    return Math.max(keep, s * inc);
  }

  return {
    retrievability,
    intervalFor(m, retention) {
      let low = 0;
      let high = Math.max(1, m.stability);
      while (retrievability(m, high) > retention && high < S_MAX) high = Math.min(2 * high, S_MAX);
      for (let i = 0; i < 60; i += 1) {
        const mid = (low + high) / 2;
        if (retrievability(m, mid) > retention) low = mid;
        else high = mid;
      }
      return (low + high) / 2;
    },
    firstMemory(g) {
      const stability = clamp(w(g - 1), S_MIN, S_MAX);
      return {
        difficulty: clamp(initDifficulty(g), 1, 10),
        stability,
        fast: clamp(stability * 0.8, S_MIN, S_MAX),
      };
    },
    nextMemory(m, g, elapsed) {
      const t = Math.max(0, elapsed);
      const s = clamp(m.stability, S_MIN, S_MAX);
      const sFast = clamp(m.fast ?? m.stability, S_MIN, S_MAX);
      const d = clamp(m.difficulty, 1, 10);
      const r = retrievability(m, t);
      const stability = nextStability(s, d, r, g, 7);
      let fast = nextStability(sFast, d, fastRecall(sFast, t), g, 15);
      if (g === 1) fast = Math.min(fast, stability * 0.8);
      const delta = -w(6) * (g - 3) * (g === 1 ? r + 0.1 : 1);
      const difficulty = 0.01 * initDifficulty(4) + 0.99 * (d + ((10 - d) * delta) / 9);
      return {
        difficulty: clamp(difficulty, 1, 10),
        stability: clamp(stability, S_MIN, S_MAX),
        fast: clamp(fast, S_MIN, S_MAX),
      };
    },
  };
}

/** FSRS-7 with the default weights. */
export const FSRS7 = createFsrs7(FSRS7_WEIGHTS);
