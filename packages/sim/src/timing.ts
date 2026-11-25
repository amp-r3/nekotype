import { logNormal } from './rng';
import type { Rng } from './rng';

/**
 * The answer-time model of the adaptive answer-time research (docs/research/2026-11-25-adaptive-
 * answer-time.md). Without it the reference learner answers in
 * `(500 + 1800(1 − p) + 120 keys) × logNormal(0.2)`, as in parts 1–5 and P7. With it the time has
 * a motor part that depends on the learner, the device, practice and the kana, a thinking part
 * whose link to the recall probability `p` can be weakened, noise and distractions.
 *
 *   motor = motor × device × (floor + (1 − floor) e^(−answers / practiceAnswers)) × kana
 *   ms    = (500 motor + 1800 (signal (1 − p) + (1 − signal) THINK_MEAN) + 120 keys motor)
 *           × logNormal(sigma) [+ 3–9 s with chance `outliers`]
 *
 * Every constant is an assumption, listed in the note.
 */

export type Device = 'desktop' | 'mobile';

export interface Timing {
  /** The learner's motor factor on a desktop before practice: 1 is the P7 learner. */
  readonly motor: number;
  /** Motor factor of a phone against a desktop. */
  readonly mobile: number;
  /** The device of an answer at `at`. */
  readonly device: (at: number) => Device;
  /** Motor factor reached after long practice (1: no speed-up). */
  readonly floor: number;
  /** Answers (recall and recognition) over which practice closes 63% of the way to `floor`. */
  readonly practiceAnswers: number;
  /** Link of the thinking time to `1 − p`: 1 as in P7, 0 none. */
  readonly signal: number;
  /** Spread of the noise (σ of the log-normal factor). */
  readonly sigma: number;
  /** Chance that an answer is distracted: 3–9 s more. */
  readonly outliers: number;
  /** σ of a motor factor per kana, independent of memory (awkward romaji, a slow key). */
  readonly kanaSpread: number;
}

/** `1 − p` of a typical correct recall: the thinking time when `signal` is 0. */
export const THINK_MEAN = 0.15;

export const DESKTOP = (): Device => 'desktop';

/** The honest default: practice, noise, distractions and a per-kana factor; full signal. */
export const TIMING: Timing = {
  motor: 1,
  mobile: 1.6,
  device: DESKTOP,
  floor: 0.7,
  practiceAnswers: 2000,
  signal: 1,
  sigma: 0.25,
  outliers: 0.03,
  kanaSpread: 0.15,
};

/** The P7 model in this form: no practice, distraction or kana factor; σ 0.2. */
export const P7_TIMING: Timing = {
  ...TIMING,
  floor: 1,
  sigma: 0.2,
  outliers: 0,
  kanaSpread: 0,
};

export interface AnswerContext {
  readonly p: number;
  readonly keys: number;
  readonly at: number;
  /** Recall and recognition answers so far. */
  readonly practice: number;
  /** The kana's own motor factor. */
  readonly kana: number;
}

export function motorOf(timing: Timing, at: number, practice: number, kana: number): number {
  const device = timing.device(at) === 'mobile' ? timing.mobile : 1;
  const learned =
    timing.floor + (1 - timing.floor) * Math.exp(-practice / Math.max(1, timing.practiceAnswers));
  return timing.motor * device * learned * kana;
}

export function answerTime(timing: Timing, c: AnswerContext, rng: Rng): number {
  const motor = motorOf(timing, c.at, c.practice, c.kana);
  const think = 1800 * (timing.signal * (1 - c.p) + (1 - timing.signal) * THINK_MEAN);
  let ms = (500 * motor + think + 120 * c.keys * motor) * logNormal(rng, timing.sigma);
  if (timing.outliers > 0 && rng.next() < timing.outliers) ms += 3000 + 6000 * rng.next();
  return ms;
}
