import type { Item } from './items';
import { logNormal } from './rng';
import type { Rng } from './rng';

/**
 * The reference learner: the "truth" the candidates are measured against. None of the candidates
 * uses this model, and it is deliberately of another family than FSRS (exponential forgetting with
 * a per-item difficulty, not a power curve), so the comparison does not favour a candidate.
 *
 * Every constant here is an assumption, listed in the research note with its reason.
 */

export const DAY_MS = 86_400_000;

/** The parameters of the reference learner; each one is an assumption listed in the research note. */
export interface ReferenceParams {
  /** Stability after the first study of a new kana, days. */
  readonly firstStability: number;
  /** Scale of the gain of stability from one successful recall. */
  readonly recallGain: number;
  /** Exponent of the forgotten share in the gain: below 1, even an easy recall helps a little. */
  readonly gainExponent: number;
  /** Recognition (choosing from 4) strengthens memory less than recall. */
  readonly recognitionShare: number;
  /** Share of the stability kept after a failed recall. */
  readonly lapseKeep: number;
  /** Chance that recognition succeeds by familiarity when recall would fail. */
  readonly familiarity: number;
  /** A kana learned before and forgotten is relearned this many times faster. */
  readonly savings: number;
  /**
   * Part 4: a katakana first studied while its hiragana is recalled (above 50%) starts with this
   * much more stability (0: the scripts are learned apart).
   */
  readonly transfer: number;
  /** Part 4: a correct recall of a composite strengthens each part with this share of a recall. */
  readonly partsShare: number;
}

export const REFERENCE: ReferenceParams = {
  firstStability: 0.02,
  recallGain: 8,
  gainExponent: 0.4,
  recognitionShare: 0.4,
  lapseKeep: 0.3,
  familiarity: 0.3,
  savings: 4,
  transfer: 0,
  partsShare: 0,
};

interface Trace {
  stability: number;
  last: number;
  seen: boolean;
  savings: number;
}

export type Profile = 'beginner' | 'knower' | 'forgot';

export interface RecallResult {
  readonly ok: boolean;
  readonly ms: number;
  /** The kana answered instead, when the error was a confusion with a similar kana. */
  readonly confusedWith: number | undefined;
}

export interface RecognitionResult {
  readonly ok: boolean;
  readonly ms: number;
  readonly chosen: number;
}

export interface Learner {
  /** Probability of recalling the kana at `now`; 0 for a kana never seen. */
  recallProbability(id: number, now: number): number;
  study(id: number, now: number): void;
  recall(id: number, now: number): RecallResult;
  recognize(id: number, options: readonly number[], now: number): RecognitionResult;
}

function difficultyOf(item: Item, rng: Rng): number {
  const shape = item.similar.length > 0 ? 1.4 : 1;
  const composite = item.parts.length > 0 ? 0.7 : 1;
  return shape * composite * logNormal(rng, 0.25);
}

export function createLearner(
  items: readonly Item[],
  profile: Profile,
  start: number,
  rng: Rng,
  params: ReferenceParams = REFERENCE,
): Learner {
  const difficulty = items.map((item) => difficultyOf(item, rng));
  const traces: Trace[] = items.map((item) => initialTrace(item, profile, start, params.savings));

  function trace(id: number): Trace {
    const t = traces[id];
    if (t === undefined) throw new Error(`no item ${id}`);
    return t;
  }

  function d(id: number): number {
    return difficulty[id] ?? 1;
  }

  function probability(id: number, now: number): number {
    const t = trace(id);
    if (!t.seen) return 0;
    return Math.exp(-(now - t.last) / (t.stability * DAY_MS));
  }

  function study(id: number, now: number): void {
    const t = trace(id);
    const item = items[id];
    const pair = item?.track === 'katakana' ? item.pair : undefined;
    const boost = pair !== undefined && probability(pair, now) > 0.5 ? 1 + params.transfer : 1;
    const fresh = (params.firstStability * t.savings * boost) / d(id);
    t.stability = t.seen ? Math.max(t.stability, fresh) : fresh;
    t.seen = true;
    t.last = now;
  }

  function strengthen(id: number, p: number, share: number, now: number): void {
    const t = trace(id);
    t.stability *= 1 + (share * params.recallGain * (1 - p) ** params.gainExponent) / d(id);
    t.last = now;
  }

  function lapse(id: number, now: number): void {
    const t = trace(id);
    t.stability = Math.max(
      (params.firstStability * t.savings) / d(id),
      t.stability * params.lapseKeep,
    );
    t.seen = true;
    t.last = now;
  }

  function answerMs(id: number, p: number): number {
    const keys = items[id]?.keys ?? 2;
    return (500 + 1800 * (1 - p) + 120 * keys) * logNormal(rng, 0.2);
  }

  return {
    recallProbability: probability,
    study,
    recall(id, now) {
      const p = probability(id, now);
      if (rng.next() < p) {
        const ms = answerMs(id, p);
        strengthen(id, p, 1, now);
        if (params.partsShare > 0) {
          for (const part of items[id]?.parts ?? []) {
            if (trace(part).seen) strengthen(part, probability(part, now), params.partsShare, now);
          }
        }
        return { ok: true, ms, confusedWith: undefined };
      }
      const similar = items[id]?.similar ?? [];
      const known = similar.filter((other) => probability(other, now) > 0.5);
      const confusedWith =
        known.length > 0 && rng.next() < 0.5
          ? known[Math.floor(rng.next() * known.length)]
          : undefined;
      // The right answer is shown after an error: a lapse, then a new study of the kana.
      lapse(id, now);
      return { ok: false, ms: answerMs(id, 0), confusedWith };
    },
    recognize(id, options, now) {
      const p = probability(id, now);
      const recalled = rng.next() < p;
      if (recalled || rng.next() < params.familiarity * (p > 0 ? 1 : 0)) {
        const ms = answerMs(id, recalled ? p : 0.5);
        if (recalled) strengthen(id, p, params.recognitionShare, now);
        else study(id, now);
        return { ok: true, ms, chosen: id };
      }
      // A guess among the options; a similar kana among them draws the guess.
      const others = options.filter((o) => o !== id);
      const lures = others.filter((o) => items[id]?.similar.includes(o) === true);
      const pool = [id, ...others, ...lures];
      const chosen = pool[Math.floor(rng.next() * pool.length)] ?? id;
      if (chosen === id) study(id, now);
      else lapse(id, now);
      return { ok: chosen === id, ms: answerMs(id, 0), chosen };
    },
  };
}

function initialTrace(item: Item, profile: Profile, start: number, savings: number): Trace {
  switch (profile) {
    case 'beginner':
      return { stability: 0, last: start, seen: false, savings: 1 };
    case 'knower':
      // Reads the basic and dakuten kana well; yōon less so.
      return {
        stability: item.category === 'yoon' ? 20 : 120,
        last: start - 2 * DAY_MS,
        seen: true,
        savings,
      };
    case 'forgot':
      // Learned the whole track once and has not used it for about a year.
      return { stability: 20, last: start - 300 * DAY_MS, seen: true, savings };
  }
}
