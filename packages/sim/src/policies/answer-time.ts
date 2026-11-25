import type { AnswerEvent } from '@nekotype/shared/types';
import type { Answer, Policy, Session } from '../policy';
import type { PolicyFactory } from '../run';

/**
 * Adaptive answer-time thresholds for the production model (adaptive answer-time research,
 * docs/research/2026-11-25-adaptive-answer-time.md). A rule decides whether a correct recall is
 * good or hard from the correct recalls before it only, as a fold of the log would;
 * `withAnswerTime` makes the production fold grade by it through the fold's `line` option. The
 * model's own rule since ADR 115 is `MODEL`, which leaves the fold its pace.
 */

/** The target answer time before ADR 115 (ms). */
const TARGET_MS = 1500;
/** A fold line that grades a correct timed answer good, or hard. */
const GOOD = Number.POSITIVE_INFINITY;
const HARD = Number.NEGATIVE_INFINITY;

/** The fold's line for a timed answer: a research rule's, or none to leave the model its pace. */
export type Line = ((answer: AnswerEvent) => number) | undefined;
/** The longest answer time an event holds. */
const MS_CAP = 10_000;

/** A correct recall as a rule sees it: what an answer event and the fold hold. */
export interface TimedAnswer {
  /** As stored: rounded, at most MS_CAP. */
  readonly ms: number;
  readonly dev: string;
  readonly track: string;
  readonly item: number;
  /** A recall of a learned kana (the fold's rule 6 counts it as a review). */
  readonly review: boolean;
  /** The answer's place in the log, 1-based: what a hash of the event's identity stands for. */
  readonly n: number;
  /** The true recall probability (NaN when unknown): only the oracle reads it. */
  readonly p: number;
}

/** How the level (in log ms) of the correct recalls is estimated. */
export type Level =
  /** The rule today: a fixed target. */
  | { readonly kind: 'fixed'; readonly ms: number }
  /** No time: every correct recall is good. */
  | { readonly kind: 'none' }
  /** Every correct recall is hard (a cold start only). */
  | { readonly kind: 'hard' }
  /** A placebo: a correct recall is hard with chance `share`, whatever its time. */
  | { readonly kind: 'random'; readonly share: number }
  /** An oracle: hard when the true recall probability before the answer is below `cut`. */
  | { readonly kind: 'oracle'; readonly cut: number }
  /** The `q` quantile of the last `size` times, × k. */
  | { readonly kind: 'window'; readonly size: number; readonly q: number; readonly k: number }
  /**
   * An exponential moving average of log time at `rate` (a running mean over the first 1/rate),
   * each step clamped to ±`clamp` (log units; Infinity: none), × k.
   */
  | { readonly kind: 'ewma'; readonly rate: number; readonly clamp: number; readonly k: number }
  /** A streaming quantile: up `step × q` when above, down `step × (1 − q)` otherwise (log units), × k. */
  | { readonly kind: 'tracker'; readonly q: number; readonly step: number; readonly k: number };

export interface Rule {
  readonly name: string;
  readonly level: Level;
  /** A level per device (`dev`), per track, or both; a group under `cold.answers` uses the global one. */
  readonly by: 'all' | 'dev' | 'track' | 'dev+track';
  /** Which correct recalls feed the level: all, or recalls of learned kana only. */
  readonly source: 'all' | 'reviews';
  /** Adds the kana's own offset from the level, learned on its reviews (shrunk by n / (n + 5)). */
  readonly kana: boolean;
  /**
   * 0: a hard threshold. Otherwise the chance of good is logistic((log threshold − log ms) / soft),
   * drawn from a hash of the event's identity, so every device folds the same grade.
   */
  readonly soft: number;
  /** Until a level has `answers` correct recalls, `before` decides. */
  readonly cold: { readonly answers: number; readonly before: 'fixed' | 'none' | 'hard' };
  /** The model grades by this rule itself (ADR 115): the fold keeps its own line. */
  readonly inModel?: boolean;
}

/** The base candidate: the median of the last 50 correct recalls × 1.2, 1500 ms before 20. */
export const BASE: Rule = {
  name: 'median 50 × 1.2',
  level: { kind: 'window', size: 50, q: 0.5, k: 1.2 },
  by: 'all',
  source: 'all',
  kana: false,
  soft: 0,
  cold: { answers: 20, before: 'fixed' },
};

export const FIXED: Rule = {
  ...BASE,
  name: 'fixed 1500',
  level: { kind: 'fixed', ms: TARGET_MS },
};

export const NO_TIME: Rule = { ...BASE, name: 'no time', level: { kind: 'none' } };

/** The rule of the model since ADR 115: a streaming 90th percentile per device. */
export const PACE_P90: Rule = {
  ...BASE,
  name: 'tracker p90, by device',
  level: { kind: 'tracker', q: 0.9, step: 0.05, k: 1 },
  by: 'dev',
  cold: { answers: 20, before: 'none' },
};

/** The same rule left to the model: the fold grades by its own pace. */
export const MODEL: Rule = { ...PACE_P90, name: 'the model (ADR 115)', inModel: true };

interface Estimator {
  count: number;
  /** The level in log ms; meaningful once `count` > 0. */
  value(): number;
  push(x: number): void;
}

function quantileOf(sorted: readonly number[], q: number): number {
  const pos = (sorted.length - 1) * q;
  const lo = sorted[Math.floor(pos)] ?? 0;
  const hi = sorted[Math.ceil(pos)] ?? lo;
  return lo + (hi - lo) * (pos - Math.floor(pos));
}

function estimator(level: Level): Estimator {
  switch (level.kind) {
    case 'window': {
      // The window in arrival order and sorted: a push inserts by binary search and removes the
      // oldest, O(size) moves; the quantile is read from the sorted copy.
      const values: number[] = [];
      const sorted: number[] = [];
      const at = (x: number): number => {
        let lo = 0;
        let hi = sorted.length;
        while (lo < hi) {
          const mid = (lo + hi) >>> 1;
          if ((sorted[mid] ?? 0) < x) lo = mid + 1;
          else hi = mid;
        }
        return lo;
      };
      return {
        count: 0,
        value: () => quantileOf(sorted, level.q),
        push(x) {
          values.push(x);
          sorted.splice(at(x), 0, x);
          if (values.length > level.size) {
            const old = values.shift() ?? x;
            sorted.splice(at(old), 1);
          }
          this.count += 1;
        },
      };
    }
    case 'ewma': {
      let m = 0;
      return {
        count: 0,
        value: () => m,
        push(x) {
          if (this.count === 0) m = x;
          else {
            const d = Math.max(-level.clamp, Math.min(level.clamp, x - m));
            m += Math.max(level.rate, 1 / (this.count + 1)) * d;
          }
          this.count += 1;
        },
      };
    }
    case 'tracker': {
      let m = 0;
      return {
        count: 0,
        value: () => m,
        push(x) {
          if (this.count === 0) m = x;
          else m += x > m ? level.step * level.q : -level.step * (1 - level.q);
          this.count += 1;
        },
      };
    }
    case 'fixed':
    case 'none':
    case 'hard':
    case 'random':
    case 'oracle':
      return { count: 0, value: () => 0, push() {} };
  }
}

function factorOf(level: Level): number {
  return level.kind === 'window' || level.kind === 'ewma' || level.kind === 'tracker' ? level.k : 1;
}

/** The decision on one correct recall: the chance it is good and the threshold used (ms; NaN when none). */
export interface Judgement {
  readonly good: number;
  readonly threshold: number;
}

export interface Threshold {
  judge(a: TimedAnswer): Judgement;
  /** Takes a correct recall into the history, after `judge`. */
  observe(a: TimedAnswer): void;
}

const KANA_PRIOR = 5;

/** The state of a rule: a pure function of the correct recalls observed so far. */
export function createThreshold(rule: Rule): Threshold {
  const global = estimator(rule.level);
  const groups = new Map<string, Estimator>();
  const kana = new Map<number, { sum: number; n: number }>();
  const groupKey = (a: TimedAnswer): string => {
    switch (rule.by) {
      case 'all':
        return '';
      case 'dev':
        return a.dev;
      case 'track':
        return a.track;
      case 'dev+track':
        return `${a.dev} ${a.track}`;
    }
  };
  const groupOf = (a: TimedAnswer): Estimator => {
    if (rule.by === 'all') return global;
    const key = groupKey(a);
    let e = groups.get(key);
    if (e === undefined) {
      e = estimator(rule.level);
      groups.set(key, e);
    }
    return e;
  };
  /** The warm level for `a`, in log ms (before k and the kana's offset), or null. */
  const levelOf = (a: TimedAnswer): number | null => {
    const own = groupOf(a);
    if (own.count >= rule.cold.answers) return own.value();
    if (global.count >= rule.cold.answers) return global.value();
    return null;
  };
  const offsetOf = (item: number): number => {
    const k = kana.get(item);
    return k === undefined ? 0 : k.sum / (k.n + KANA_PRIOR);
  };
  const k = Math.log(factorOf(rule.level));

  return {
    judge(a) {
      const x = Math.log(Math.max(1, a.ms));
      const { level } = rule;
      if (level.kind === 'fixed') return { good: a.ms <= level.ms ? 1 : 0, threshold: level.ms };
      if (level.kind === 'none') return { good: 1, threshold: Number.NaN };
      if (level.kind === 'hard') return { good: 0, threshold: Number.NaN };
      if (level.kind === 'random') return { good: 1 - level.share, threshold: Number.NaN };
      if (level.kind === 'oracle') return { good: a.p >= level.cut ? 1 : 0, threshold: Number.NaN };
      const warm = levelOf(a);
      if (warm === null) {
        switch (rule.cold.before) {
          case 'fixed':
            return { good: a.ms <= TARGET_MS ? 1 : 0, threshold: TARGET_MS };
          case 'none':
            return { good: 1, threshold: Number.NaN };
          case 'hard':
            return { good: 0, threshold: Number.NaN };
        }
      }
      const log = warm + k + (rule.kana ? offsetOf(a.item) : 0);
      const good = rule.soft > 0 ? 1 / (1 + Math.exp(-(log - x) / rule.soft)) : x <= log ? 1 : 0;
      return { good, threshold: Math.exp(log) };
    },
    observe(a) {
      const x = Math.log(Math.max(1, a.ms));
      if (rule.kana && a.review) {
        const warm = levelOf(a);
        if (warm !== null) {
          const entry = kana.get(a.item) ?? { sum: 0, n: 0 };
          entry.sum += x - warm;
          entry.n += 1;
          kana.set(a.item, entry);
        }
      }
      if (rule.source === 'reviews' && !a.review) return;
      const own = groupOf(a);
      own.push(x);
      if (own !== global) global.push(x);
    },
  };
}

/** What a run's rule did with its correct recalls. */
export interface TimeStats {
  readonly at: number[];
  readonly good: boolean[];
  readonly threshold: number[];
}

/** A uniform number in [0, 1) from an event's place in the log: the fold's stand-in for a hash of (dev, n). */
export function hash01(n: number): number {
  let t = (n + 0x6d2b79f5) >>> 0;
  t = Math.imul(t ^ (t >>> 15), t | 1);
  t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
  return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
}

/**
 * `base` with `rule` deciding good and hard: `base(line)` is the production policy whose fold takes
 * that line. `deviceOf` is the device of an answer at a time (the event's `dev`). `last()` is the
 * statistics of the policy made last: the harness makes one per run. A rule `inModel` leaves the
 * fold its pace and is judged here only for the statistics.
 */
export function withAnswerTime(
  base: (line: Line) => PolicyFactory,
  rule: Rule,
  deviceOf: (at: number) => string,
): { readonly factory: PolicyFactory; readonly last: () => TimeStats | undefined } {
  let stats: TimeStats | undefined;
  const factory: PolicyFactory = (items, rng) => {
    // The decision on the answer being recorded: the fold asks for its line while it applies it.
    let decision = GOOD;
    const inner = base(rule.inModel === true ? undefined : () => decision)(items, rng);
    const threshold = createThreshold(rule);
    const own: TimeStats = { at: [], good: [], threshold: [] };
    stats = own;
    let n = 0;
    const timed = (answer: Answer): TimedAnswer => {
      n += 1;
      return {
        ms: Math.min(MS_CAP, Math.max(0, Math.round(answer.ms))),
        dev: deviceOf(answer.at),
        track: items[answer.task.item]?.track ?? 'hiragana',
        item: answer.task.item,
        review: answer.task.review,
        n,
        p: answer.p ?? Number.NaN,
      };
    };
    const policy: Policy = {
      name: `${inner.name}, ${rule.name}`,
      session(now, first): Session {
        const session = inner.session(now, first);
        return {
          kind: session.kind,
          next: (at) => session.next(at),
          record(answer) {
            if (answer.task.kind !== 'recall' || !answer.ok) {
              if (answer.task.kind !== 'introduction') n += 1;
              session.record(answer);
              return;
            }
            const a = timed(answer);
            const j = threshold.judge(a);
            const good = j.good >= 1 || (j.good > 0 && hash01(a.n) < j.good);
            own.at.push(answer.at);
            own.good.push(good);
            own.threshold.push(j.threshold);
            threshold.observe(a);
            decision = good ? GOOD : HARD;
            session.record(answer);
            decision = GOOD;
          },
        };
      },
      unlocked: () => inner.unlocked(),
      calibrate(answers) {
        for (const answer of answers) {
          if (answer.task.kind === 'recall' && answer.ok)
            threshold.observe({ ...timed(answer), review: true });
        }
      },
    };
    return policy;
  };
  return { factory, last: () => stats };
}
