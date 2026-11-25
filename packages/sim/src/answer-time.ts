import { performance } from 'node:perf_hooks';
import { foldLog, trackItems } from '@nekotype/model';
import type { ModelState } from '@nekotype/model';
import { syntheticLog } from '@nekotype/model/testing';
import { DAY_MS, REFERENCE } from './learner';
import type { Profile, ReferenceParams } from './learner';
import {
  BASE,
  createThreshold,
  FIXED,
  MODEL,
  NO_TIME,
  PACE_P90,
  withAnswerTime,
} from './policies/answer-time';
import type { Level, Line, Rule, TimeStats } from './policies/answer-time';
import { createProductionPolicy } from './policies/production';
import { simulate } from './run';
import type { PolicyFactory, RunResult, SimOptions } from './run';
import { TIMING } from './timing';
import type { Device, Timing } from './timing';

/**
 * The tables of the adaptive answer-time research (docs/research/2026-11-25-adaptive-answer-
 * time.md), on the production model: `PART=frontier|motor|signal|level|source|profiles|devices|
 * practice|cold|placement|tracks|cost` picks one; without it all are printed. `SEEDS` (100).
 */

const PART = process.env['PART'];
const want = (part: string): boolean => PART === undefined || PART === part;
const SEEDS = Number(process.env['SEEDS'] ?? 100);
const DAYS = 60;

/** A production policy whose fold takes `line`, with events of the device of their time. */
type Production = (line: Line, deviceOf: (at: number) => string) => PolicyFactory;

const HIRAGANA: Production = (line, deviceOf) =>
  createProductionPolicy('hiragana', { line, deviceOf });

const BASIC_HIRAGANA = trackItems('hiragana')
  .filter((item) => item.category === 'basic')
  .map((item) => item.key);

/**
 * The production model for a learner who takes the katakana suggestion: hiragana until the 46
 * basic hiragana are learned (the suggestion of `describe`), then katakana for good.
 */
const FOLLOWS_SUGGESTION: Production = (line, deviceOf) => (items, rng) => {
  let katakana = false;
  const track = (state: ModelState): 'hiragana' | 'katakana' => {
    katakana ||= BASIC_HIRAGANA.every((key) => state.items.get(key)?.phase === 'learned');
    return katakana ? 'katakana' : 'hiragana';
  };
  return createProductionPolicy(track, { line, deviceOf })(items, rng);
};

interface Case {
  readonly name: string;
  readonly profile: Profile;
  readonly reference: ReferenceParams;
  readonly timing: Timing;
  readonly tracks: 'hiragana' | 'both';
  readonly placement: number;
  readonly policy: Production;
}

const learner = (name: string, timing: Partial<Timing> = {}, over: Partial<Case> = {}): Case => ({
  name,
  profile: 'beginner',
  reference: REFERENCE,
  timing: { ...TIMING, ...timing },
  tracks: 'hiragana',
  placement: 0,
  policy: HIRAGANA,
  ...over,
});

interface Run {
  readonly result: RunResult;
  readonly stats: TimeStats;
}

function play(rule: Rule, c: Case, seeds: number = SEEDS): Run[] {
  const wrapped = withAnswerTime((line) => c.policy(line, c.timing.device), rule, c.timing.device);
  const options: SimOptions = { timing: c.timing, tracks: c.tracks, placement: c.placement };
  return Array.from({ length: seeds }, (_, seed) => {
    const result = simulate(wrapped.factory, c.profile, seed + 1, DAYS, c.reference, options);
    const stats = wrapped.last();
    if (stats === undefined) throw new Error('no statistics');
    return { result, stats };
  });
}

function quantile(values: readonly number[], q: number): number {
  const sorted = [...values].sort((a, b) => a - b);
  if (sorted.length === 0) return Number.NaN;
  const pos = (sorted.length - 1) * q;
  const lo = sorted[Math.floor(pos)] ?? Number.NaN;
  const hi = sorted[Math.ceil(pos)] ?? lo;
  return lo + (hi - lo) * (pos - Math.floor(pos));
}

const med = (values: readonly number[]): number => quantile(values, 0.5);

function spread(values: readonly number[], digits: number): string {
  const f = (v: number): string => v.toFixed(digits);
  return `${f(quantile(values, 0.5))} (${f(quantile(values, 0.1))}–${f(quantile(values, 0.9))})`;
}

function lines(header: readonly string[], rows: readonly (readonly string[])[]): string {
  return [
    `| ${header.join(' | ')} |`,
    `|${' --- |'.repeat(header.length)}`,
    ...rows.map((row) => `| ${row.join(' | ')} |`),
  ].join('\n');
}

/** A day reached by a share of the runs: the median over all runs, "never" counted as DAYS + 1. */
function day(runs: readonly Run[], pick: (r: RunResult) => number | undefined): string {
  const values = runs.map((r) => pick(r.result) ?? DAYS + 1);
  const m = med(values);
  return m > DAYS ? `>${DAYS}` : m.toFixed(0);
}

function share(stats: TimeStats, from: number, to: number): number | undefined {
  let n = 0;
  let good = 0;
  for (const [i, at] of stats.at.entries()) {
    if (at < from || at >= to) continue;
    n += 1;
    if (stats.good[i] === true) good += 1;
  }
  return n === 0 ? undefined : good / n;
}

function firstShare(stats: TimeStats, count: number): number {
  const first = stats.good.slice(0, count);
  return first.length === 0 ? Number.NaN : first.filter(Boolean).length / first.length;
}

const pct = (values: readonly (number | undefined)[], digits = 0): string => {
  const known = values.flatMap((v) => (v === undefined || Number.isNaN(v) ? [] : [100 * v]));
  return known.length === 0 ? '—' : `${med(known).toFixed(digits)}%`;
};

/** The main columns: what the learner gets and what it costs. */
const MAIN_HEADER = [
  'reads 46, day',
  'reads track, day',
  'kana recalled, day 14',
  'after a 30-day break',
  'review retention',
  'retention',
  'min/day',
  'good',
] as const;

function mainCells(runs: readonly Run[], dayKnown = 14): string[] {
  const r = runs.map((x) => x.result);
  return [
    day(runs, (x) => x.readsBasicDay),
    day(runs, (x) => x.readsTrackDay),
    med(r.map((x) => x.known[dayKnown - 1] ?? 0)).toFixed(1),
    med(r.map((x) => x.afterBreak[1])).toFixed(1),
    pct(
      r.map((x) => x.reviewRetention),
      1,
    ),
    pct(
      r.map((x) => x.retention),
      1,
    ),
    med(r.map((x) => x.minutesPerDay)).toFixed(1),
    pct(runs.map((x) => x.stats.good.filter(Boolean).length / Math.max(1, x.stats.good.length))),
  ];
}

function mainTable(
  title: string,
  note: string,
  cases: readonly Case[],
  rules: readonly Rule[],
): void {
  const rows: string[][] = [];
  for (const c of cases)
    for (const rule of rules) rows.push([c.name, rule.name, ...mainCells(play(rule, c))]);
  console.log(`\n## ${title}\n\n${note} ${SEEDS} seeds, ${DAYS} days; medians.\n`);
  console.log(lines(['learner', 'rule', ...MAIN_HEADER], rows));
}

const rule = (name: string, over: Partial<Rule>): Rule => ({ ...BASE, name, ...over });
const window = (size: number, q: number, k: number): Level => ({ kind: 'window', size, q, k });
const MEDIAN_15 = rule('median 50 × 1.5', { level: window(50, 0.5, 1.5) });
const placebo = (s: number): Rule =>
  rule(`placebo ${Math.round(100 * s)}% hard`, { level: { kind: 'random', share: s } });
/** A streaming quantile per device: hard when slower than the device's recent `q` quantile. */
const tracker = (q: number): Rule =>
  rule(`tracker p${Math.round(100 * q)}, by device`, {
    level: { kind: 'tracker', q, step: 0.05, k: 1 },
    by: 'dev',
    cold: { answers: 20, before: 'none' },
  });
/** The recommendation of the note. */
const RECOMMENDED = PACE_P90;
const oracle = (cut: number): Rule =>
  rule(`oracle: hard below p ${cut}`, { level: { kind: 'oracle', cut } });

const M1 = learner('motor 1');
const M25 = learner('motor 2.5', { motor: 2.5 });

if (want('frontier')) {
  mainTable(
    'Frontier: time against a placebo',
    'A placebo grades a correct recall hard at random with a fixed chance; a rule that reads information from the time should give more for the same share of good. Beginner, honest timing.',
    [
      M1,
      M25,
      learner('motor 1, recallGain ×0.5', {}, { reference: { ...REFERENCE, recallGain: 4 } }),
    ],
    [
      NO_TIME,
      placebo(0.1),
      placebo(0.2),
      placebo(0.3),
      placebo(0.5),
      oracle(0.85),
      oracle(0.9),
      oracle(0.95),
      FIXED,
      BASE,
      MEDIAN_15,
    ],
  );
}

if (want('motor')) {
  mainTable(
    'Motor speed',
    'Beginner, honest timing, motor factor 0.6–2.5.',
    [0.6, 1, 1.6, 2.5].map((motor) => learner(`motor ${motor}`, { motor })),
    [FIXED, NO_TIME, BASE, MEDIAN_15],
  );
}

if (want('signal')) {
  const cases = [1, 0.5, 0.2, 0].flatMap((signal) => [
    learner(`motor 1, signal ${signal}`, { signal }),
    learner(`motor 2.5, signal ${signal}`, { motor: 2.5, signal }),
  ]);
  mainTable(
    'Signal strength',
    'How strongly the thinking time follows 1 − p (0: not at all). Beginner, honest timing.',
    cases,
    [NO_TIME, FIXED, BASE],
  );
}

const LEVELS: readonly Rule[] = [
  BASE,
  rule('median 20 × 1.2', { level: window(20, 0.5, 1.2) }),
  rule('median 100 × 1.2', { level: window(100, 0.5, 1.2) }),
  rule('median 200 × 1.2', { level: window(200, 0.5, 1.2) }),
  rule('median 50 × 1.1', { level: window(50, 0.5, 1.1) }),
  rule('median 50 × 1.3', { level: window(50, 0.5, 1.3) }),
  rule('p70 of 50', { level: window(50, 0.7, 1) }),
  rule('p75 of 50', { level: window(50, 0.75, 1) }),
  rule('p80 of 50', { level: window(50, 0.8, 1) }),
  rule('EWMA 0.05 × 1.2', {
    level: { kind: 'ewma', rate: 0.05, clamp: Number.POSITIVE_INFINITY, k: 1.2 },
  }),
  rule('EWMA 0.05 ±0.5 × 1.2', { level: { kind: 'ewma', rate: 0.05, clamp: 0.5, k: 1.2 } }),
  rule('EWMA 0.02 ±0.5 × 1.2', { level: { kind: 'ewma', rate: 0.02, clamp: 0.5, k: 1.2 } }),
  rule('tracker p70, step 0.05', { level: { kind: 'tracker', q: 0.7, step: 0.05, k: 1 } }),
  rule('tracker p75, step 0.05', { level: { kind: 'tracker', q: 0.75, step: 0.05, k: 1 } }),
  rule('tracker p75, step 0.02', { level: { kind: 'tracker', q: 0.75, step: 0.02, k: 1 } }),
];

/** The spread of the share of good across seeds and across the weeks of a run. */
function goodCells(runs: readonly Run[]): string[] {
  const all = runs.map(
    (x) => x.stats.good.filter(Boolean).length / Math.max(1, x.stats.good.length),
  );
  const week = (w: number): (number | undefined)[] =>
    runs.map((x) => share(x.stats, w * 7 * DAY_MS, (w + 1) * 7 * DAY_MS));
  return [
    `${spread(
      all.map((v) => 100 * v),
      0,
    )}%`,
    pct(week(0)),
    pct(week(3)),
    pct(week(7)),
  ];
}

if (want('level')) {
  const cases = [M1, M25, learner('motor 1, signal 0.5', { signal: 0.5 })];
  const rows: string[][] = [];
  for (const c of cases)
    for (const r of LEVELS) {
      const runs = play(r, c);
      const main = mainCells(runs);
      rows.push([c.name, r.name, ...main.slice(0, 2), ...main.slice(4, 5), ...goodCells(runs)]);
    }
  console.log(
    `\n## Level estimators\n\nBeginner, honest timing (practice, distractions). Good: the share of good among correct recalls, median (p10–p90 over seeds), then by week 1, 4 and 8. ${SEEDS} seeds, ${DAYS} days.\n`,
  );
  console.log(
    lines(
      [
        'learner',
        'rule',
        'reads 46, day',
        'reads track, day',
        'review retention',
        'good',
        'week 1',
        'week 4',
        'week 8',
      ],
      rows,
    ),
  );
}

if (want('source')) {
  mainTable(
    'What feeds the level',
    'All correct recalls, or reviews of learned kana only (the motor reference); a per-kana offset; a soft threshold (chance of good by a logistic of the log-time distance, drawn from a hash of the event). Beginner, honest timing.',
    [M1, M25, learner('motor 1, signal 0.5', { signal: 0.5 })],
    [
      BASE,
      rule('median 50 × 1.2, reviews', { source: 'reviews' }),
      rule('median 50 × 1.1, reviews', { source: 'reviews', level: window(50, 0.5, 1.1) }),
      rule('median 50 × 1.2, kana offset', { kana: true }),
      rule('median 50 × 1.2, reviews, kana offset', { source: 'reviews', kana: true }),
      rule('median 50 × 1.2, soft 0.1', { soft: 0.1 }),
      rule('median 50 × 1.2, soft 0.2', { soft: 0.2 }),
    ],
  );
}

/** The candidates kept after the level and source tables. */
const CANDIDATES: readonly Rule[] = [
  NO_TIME,
  FIXED,
  BASE,
  rule('EWMA 0.05 ±0.5 × 1.2, by device', {
    level: { kind: 'ewma', rate: 0.05, clamp: 0.5, k: 1.2 },
    by: 'dev',
  }),
];

if (want('profiles')) {
  const cases: Case[] = [];
  for (const profile of ['beginner', 'knower', 'forgot'] as const)
    for (const [gain, reference] of [
      ['', REFERENCE],
      [', recallGain ×0.5', { ...REFERENCE, recallGain: REFERENCE.recallGain * 0.5 }],
    ] as const)
      for (const motor of [1, 2.5])
        cases.push(learner(`${profile}${gain}, motor ${motor}`, { motor }, { profile, reference }));
  mainTable('Profiles', 'Honest timing.', cases, CANDIDATES);
}

const SWITCH_DAY = 14;
const switched = (at: number): Device => (at >= SWITCH_DAY * DAY_MS ? 'mobile' : 'desktop');
const mixed = (at: number): Device => (at % DAY_MS < 12 * 3_600_000 ? 'mobile' : 'desktop');

/** Correct recalls after `from` until 20 in a row hold at least `level` good; undefined: never. */
function recovery(stats: TimeStats, from: number, level: number): number | undefined {
  const start = stats.at.findIndex((at) => at >= from);
  if (start < 0) return undefined;
  for (let i = start + 19; i < stats.good.length; i += 1) {
    const last = stats.good.slice(i - 19, i + 1).filter(Boolean).length / 20;
    if (last >= level) return i - start + 1;
  }
  return undefined;
}

if (want('devices')) {
  const rules: Rule[] = [
    FIXED,
    BASE,
    rule('median 50 × 1.2, by device', { by: 'dev' }),
    rule('median 20 × 1.2, by device', { by: 'dev', level: window(20, 0.5, 1.2) }),
    rule('EWMA 0.05 ±0.5 × 1.2', { level: { kind: 'ewma', rate: 0.05, clamp: 0.5, k: 1.2 } }),
    rule('EWMA 0.05 ±0.5 × 1.2, by device', {
      level: { kind: 'ewma', rate: 0.05, clamp: 0.5, k: 1.2 },
      by: 'dev',
    }),
    RECOMMENDED,
  ];
  const rows: string[][] = [];
  for (const motor of [1, 2.5]) {
    const c = learner(`motor ${motor}, phone from day ${SWITCH_DAY + 1}`, {
      motor,
      device: switched,
    });
    for (const r of rules) {
      const runs = play(r, c);
      const at = (d: number): number => d * DAY_MS;
      const before = runs.map((x) => share(x.stats, at(SWITCH_DAY - 7), at(SWITCH_DAY)));
      rows.push([
        c.name,
        r.name,
        ...mainCells(runs).slice(0, 2),
        pct(before),
        pct(runs.map((x) => share(x.stats, at(SWITCH_DAY), at(SWITCH_DAY + 1)))),
        pct(runs.map((x) => share(x.stats, at(SWITCH_DAY + 1), at(SWITCH_DAY + 3)))),
        pct(runs.map((x) => share(x.stats, at(SWITCH_DAY + 3), at(SWITCH_DAY + 10)))),
        (() => {
          const n = runs.flatMap((x, i) => {
            const level = (before[i] ?? 0.7) - 0.1;
            const v = recovery(x.stats, at(SWITCH_DAY), level);
            return v === undefined ? [] : [v];
          });
          return n.length < runs.length / 2 ? 'never' : med(n).toFixed(0);
        })(),
      ]);
    }
  }
  console.log(
    `\n## Change of device\n\nDesktop until day ${SWITCH_DAY}, a phone (motor ×${TIMING.mobile}) from day ${SWITCH_DAY + 1}. Good: the share of good in the week before, on the first day of the phone, days 2–3 and days 4–10. Recovery: correct recalls on the phone until 20 in a row hold the share of the week before less 10 points. ${SEEDS} seeds.\n`,
  );
  console.log(
    lines(
      [
        'learner',
        'rule',
        'reads 46, day',
        'reads track, day',
        'good, week before',
        'first day',
        'days 2–3',
        'days 4–10',
        'recovery, recalls',
      ],
      rows,
    ),
  );

  const mixedRows: string[][] = [];
  for (const motor of [1, 2.5]) {
    const c = learner(`motor ${motor}, phone mornings`, { motor, device: mixed });
    for (const r of rules) {
      const runs = play(r, c);
      const byDevice = (device: Device): (number | undefined)[] =>
        runs.map((x) => {
          const good = x.stats.good.filter((_, i) => mixed(x.stats.at[i] ?? 0) === device);
          return good.length === 0 ? undefined : good.filter(Boolean).length / good.length;
        });
      mixedRows.push([
        c.name,
        r.name,
        ...mainCells(runs).slice(0, 2),
        ...mainCells(runs).slice(4, 6),
        pct(byDevice('desktop')),
        pct(byDevice('mobile')),
      ]);
    }
  }
  console.log(
    `\n### Two devices every day\n\nThe morning sitting on a phone, the evening one on a desktop. ${SEEDS} seeds, ${DAYS} days.\n`,
  );
  console.log(
    lines(
      [
        'learner',
        'rule',
        'reads 46, day',
        'reads track, day',
        'review retention',
        'retention',
        'good on desktop',
        'good on phone',
      ],
      mixedRows,
    ),
  );
}

if (want('practice')) {
  const cases = [1.6, 2.5].flatMap((motor) => [
    learner(`motor ${motor}, no practice`, { motor, floor: 1 }),
    learner(`motor ${motor}, practice to ×0.5 over 1000`, {
      motor,
      floor: 0.5,
      practiceAnswers: 1000,
    }),
  ]);
  const rows: string[][] = [];
  for (const c of cases)
    for (const r of [FIXED, BASE, rule('median 200 × 1.2', { level: window(200, 0.5, 1.2) })]) {
      const runs = play(r, c);
      rows.push([c.name, r.name, ...mainCells(runs).slice(0, 2), ...goodCells(runs)]);
    }
  console.log(
    `\n## Practice\n\nThe learner gets faster: the motor part falls to the floor over the answers (63% of the way at the given count). ${SEEDS} seeds, ${DAYS} days.\n`,
  );
  console.log(
    lines(
      [
        'learner',
        'rule',
        'reads 46, day',
        'reads track, day',
        'good',
        'week 1',
        'week 4',
        'week 8',
      ],
      rows,
    ),
  );
}

if (want('cold')) {
  const rows: string[][] = [];
  const cases = [
    M1,
    M25,
    learner('knower, motor 1', {}, { profile: 'knower' }),
    learner('knower, motor 2.5', { motor: 2.5 }, { profile: 'knower' }),
  ];
  for (const c of cases)
    for (const answers of [10, 20, 50])
      for (const before of ['fixed', 'none', 'hard'] as const) {
        const r = rule(`${answers}, ${before} before`, { cold: { answers, before } });
        const runs = play(r, c);
        const main = mainCells(runs);
        rows.push([
          c.name,
          r.name,
          ...main.slice(0, 2),
          med(runs.map((x) => x.result.known[6] ?? 0)).toFixed(1),
          main[4] ?? '',
          main[6] ?? '',
          pct(runs.map((x) => firstShare(x.stats, 100))),
          String(med(runs.map((x) => x.result.reviews))),
        ]);
      }
  console.log(
    `\n## Cold start\n\nThe base rule (median 50 × 1.2) with N correct recalls before it decides, and what decides before: 1500 ms, no time (good), or hard. ${SEEDS} seeds, ${DAYS} days.\n`,
  );
  console.log(
    lines(
      [
        'learner',
        'cold start',
        'reads 46, day',
        'reads track, day',
        'kana recalled, day 7',
        'review retention',
        'min/day',
        'good, first 100',
        'reviews',
      ],
      rows,
    ),
  );
}

if (want('placement')) {
  const rows: string[][] = [];
  for (const profile of ['knower', 'forgot'] as const)
    for (const motor of [1, 2.5])
      for (const placement of [0, 10, 20, 46]) {
        const c = learner(`${profile}, motor ${motor}`, { motor }, { profile, placement });
        for (const r of [
          rule('cold: 1500 before 20', {}),
          rule('cold: none before 20', { cold: { answers: 20, before: 'none' } }),
        ]) {
          const runs = play(r, c);
          const main = mainCells(runs);
          rows.push([
            c.name,
            String(placement),
            r.name,
            main[1] ?? '',
            main[4] ?? '',
            main[6] ?? '',
            pct(runs.map((x) => firstShare(x.stats, 100))),
            String(med(runs.map((x) => x.result.reviews))),
          ]);
        }
      }
  console.log(
    `\n## Placement\n\nA placement test of N timed recalls of the basic kana in track order before the first day, given to the threshold only (the base rule, median 50 × 1.2). ${SEEDS} seeds, ${DAYS} days.\n`,
  );
  console.log(
    lines(
      [
        'learner',
        'placement recalls',
        'cold start',
        'reads track, day',
        'review retention',
        'min/day',
        'good, first 100',
        'reviews',
      ],
      rows,
    ),
  );
}

if (want('tracks')) {
  const cases = [1, 2.5].map((motor) =>
    learner(
      `both tracks, motor ${motor}`,
      { motor },
      { tracks: 'both', policy: FOLLOWS_SUGGESTION },
    ),
  );
  const rows: string[][] = [];
  for (const c of cases)
    for (const r of [NO_TIME, FIXED, BASE, rule('median 50 × 1.2, by track', { by: 'track' })]) {
      const runs = play(r, c);
      const res = runs.map((x) => x.result);
      rows.push([
        c.name,
        r.name,
        day(runs, (x) => x.readsBasicDay),
        day(runs, (x) => x.readsKatakanaDay),
        day(runs, (x) => x.readsTrackDay),
        med(res.map((x) => x.known[29] ?? 0)).toFixed(1),
        pct(
          res.map((x) => x.reviewRetention),
          1,
        ),
        med(res.map((x) => x.minutesPerDay)).toFixed(1),
        pct(
          runs.map((x) => x.stats.good.filter(Boolean).length / Math.max(1, x.stats.good.length)),
        ),
      ]);
    }
  console.log(
    `\n## Both tracks\n\nThe production model on both tracks; the learner selects katakana once the model suggests it (the 46 basic hiragana learned). Honest timing. ${SEEDS} seeds, ${DAYS} days.\n`,
  );
  console.log(
    lines(
      [
        'learner',
        'rule',
        'reads 46 hiragana, day',
        'reads 46 katakana, day',
        'reads 229, day',
        'kana recalled, day 30',
        'review retention',
        'min/day',
        'good',
      ],
      rows,
    ),
  );
}

if (want('final')) {
  const cases: (readonly [Case, number])[] = [
    [learner('motor 0.6', { motor: 0.6 }), 14],
    [M1, 14],
    [M25, 14],
    [learner('motor 1, recallGain ×0.5', {}, { reference: { ...REFERENCE, recallGain: 4 } }), 14],
    [learner('motor 2.5, signal 0', { motor: 2.5, signal: 0 }), 14],
    [learner('knower, motor 2.5', { motor: 2.5 }, { profile: 'knower' }), 14],
    [learner('forgot, motor 1', {}, { profile: 'forgot' }), 14],
    [learner('motor 2.5, phone mornings', { motor: 2.5, device: mixed }), 14],
    [learner('both tracks, motor 1', {}, { tracks: 'both', policy: FOLLOWS_SUGGESTION }), 30],
    [
      learner(
        'both tracks, motor 2.5',
        { motor: 2.5 },
        { tracks: 'both', policy: FOLLOWS_SUGGESTION },
      ),
      30,
    ],
  ];
  const rules = [NO_TIME, placebo(0.1), FIXED, BASE, MEDIAN_15, tracker(0.8), RECOMMENDED, MODEL];
  const rows: string[][] = [];
  for (const [c, known] of cases)
    for (const r of rules) {
      const runs = play(r, c);
      const main = mainCells(runs, known);
      main[2] = `${main[2] ?? ''} (d${known})`;
      rows.push([c.name, r.name, ...main]);
    }
  console.log(
    `\n## Final candidates\n\nThe candidates against no time, a 10% placebo and the rule today. "Kana recalled" is on day 14 for one track and day 30 for both (229 kana). ${SEEDS} seeds, ${DAYS} days; medians.\n`,
  );
  console.log(lines(['learner', 'rule', ...MAIN_HEADER], rows));
}

if (want('cost')) {
  const events = syntheticLog({ answers: 40_000, seed: 1 });
  const answers = events.flatMap((e) =>
    e.t === 'answer' && e.task === 'recall' && e.ok ? [e] : [],
  );
  const time = (f: () => void): number => {
    const timings: number[] = [];
    for (let run = 0; run < 6; run += 1) {
      const t = performance.now();
      f();
      if (run > 0) timings.push(performance.now() - t);
    }
    return med(timings);
  };
  const fold = time(() => {
    foldLog(events, { stats: true });
  });
  const rows = [
    FIXED,
    BASE,
    rule('median 50 × 1.2, by device', { by: 'dev' }),
    rule('EWMA 0.05 ±0.5 × 1.2', { level: { kind: 'ewma', rate: 0.05, clamp: 0.5, k: 1.2 } }),
    rule('EWMA 0.05 ±0.5 × 1.2, by device', {
      level: { kind: 'ewma', rate: 0.05, clamp: 0.5, k: 1.2 },
      by: 'dev',
    }),
    rule('tracker p75, step 0.05', { level: { kind: 'tracker', q: 0.75, step: 0.05, k: 1 } }),
    RECOMMENDED,
  ].map((r) => {
    const ms = time(() => {
      const t = createThreshold(r);
      for (const [n, e] of answers.entries()) {
        const a = { ms: e.ms, dev: e.dev, track: 'hiragana', item: 0, review: false, n, p: 1 };
        t.judge(a);
        t.observe(a);
      }
    });
    return [r.name, ms.toFixed(2), `${((100 * ms) / fold).toFixed(1)}%`];
  });
  console.log(
    `\n## Cost\n\nNode, the seeded log of 40,000 answers (${events.length} events, ${answers.length} correct recalls): foldLog with statistics takes ${fold.toFixed(1)} ms (median of five). A rule's judge and observe over every correct recall of the same log:\n`,
  );
  console.log(lines(['rule', 'ms', 'of the fold'], rows));
}
