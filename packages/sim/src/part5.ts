import { performance } from 'node:perf_hooks';
import type { Memory } from './memory';
import { FSRS7 } from './fsrs7';
import { hiraganaItems } from './items';
import { DAY_MS, REFERENCE } from './learner';
import type { Profile, ReferenceParams } from './learner';
import {
  createFsrsPlanner,
  FSRS6_MODEL,
  FSRS7_MODEL,
  freshCore,
  PLANNER_A4,
} from './policies/fsrs-planner';
import type { MemoryModel, Planner, PlannerParams } from './policies/fsrs-planner';
import type { Answer } from './policy';
import { createRng } from './rng';
import { simulate } from './run';
import type { Estimator, Outcome, PolicyFactory, RunResult } from './run';

/**
 * The tables of part 5 of the research note: candidate A4 on FSRS-7 against FSRS-6. `PART=main|
 * planner|calibration|forecast|rebuild|mastery` picks one table; without it all are printed.
 */

const PART = process.env['PART'];
const want = (part: string): boolean => PART === undefined || PART === part;

const MODELS: readonly (readonly [string, MemoryModel])[] = [
  ['FSRS-6', FSRS6_MODEL],
  ['FSRS-7', FSRS7_MODEL],
];
const NO_LOOK_AHEAD: PlannerParams = { ...PLANNER_A4, horizon: 0 };
const GAP_1: PlannerParams = { ...PLANNER_A4, reviewGapMs: 60_000 };
const GAP_20: PlannerParams = { ...PLANNER_A4, reviewGapMs: 20 * 60_000 };

/** A planner and a memory model under a name. */
type Variant = readonly [string, PlannerParams, MemoryModel];

const VARIANTS: readonly Variant[] = [
  ['A4, FSRS-6', PLANNER_A4, FSRS6_MODEL],
  ['A4, FSRS-7', PLANNER_A4, FSRS7_MODEL],
  ['A4 + 1 min gap, FSRS-6', GAP_1, FSRS6_MODEL],
  ['A4 + 1 min gap, FSRS-7', GAP_1, FSRS7_MODEL],
  ['A4 + 20 min gap, FSRS-6', GAP_20, FSRS6_MODEL],
  ['A4 + 20 min gap, FSRS-7', GAP_20, FSRS7_MODEL],
  ['A4 without look-ahead, FSRS-6', NO_LOOK_AHEAD, FSRS6_MODEL],
  ['A4 without look-ahead, FSRS-7', NO_LOOK_AHEAD, FSRS7_MODEL],
];
const variant = (name: string): Variant => {
  const found = VARIANTS.find(([n]) => n === name);
  if (found === undefined) throw new Error(`no variant ${name}`);
  return found;
};
const factoryOf = ([, params, model]: Variant): PolicyFactory => createFsrsPlanner(params, model);

function quantile(values: readonly number[], q: number): number {
  const sorted = [...values].sort((a, b) => a - b);
  if (sorted.length === 0) return Number.NaN;
  const pos = (sorted.length - 1) * q;
  const lo = sorted[Math.floor(pos)] ?? Number.NaN;
  const hi = sorted[Math.ceil(pos)] ?? lo;
  return lo + (hi - lo) * (pos - Math.floor(pos));
}

function median(values: readonly number[]): number {
  const sorted = [...values].sort((a, b) => a - b);
  return sorted[Math.floor(sorted.length / 2)] ?? Number.NaN;
}

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

function runs(
  factory: PolicyFactory,
  seeds: number,
  days: number,
  reference: ReferenceParams = REFERENCE,
  profile: Profile = 'beginner',
  forward = 0,
): RunResult[] {
  return Array.from({ length: seeds }, (_, seed) =>
    simulate(
      factory,
      profile,
      seed + 1,
      days,
      reference,
      forward > 0 ? { forward, daily: true } : {},
    ),
  );
}

/** A factory that keeps every answer its planner records, and the last planner it built. */
function recording(params: PlannerParams, model: MemoryModel) {
  const answers: Answer[] = [];
  let last: Planner | undefined;
  const factory: PolicyFactory = (items, rng) => {
    const planner = createFsrsPlanner(params, model)(items, rng);
    last = planner;
    return {
      ...planner,
      session(now, first) {
        const session = planner.session(now, first);
        return {
          ...session,
          record(answer: Answer) {
            answers.push(answer);
            session.record(answer);
          },
        };
      },
    };
  };
  return { factory, answers, planner: () => last };
}

if (want('main')) {
  const SEEDS = Number(process.env['SEEDS'] ?? 50);
  const DAYS = 60;
  const days = (results: readonly RunResult[], pick: (r: RunResult) => number | undefined) => {
    const reached = results.flatMap((r) => {
      const v = pick(r);
      return v === undefined ? [] : [v];
    });
    const share = `${Math.round((100 * reached.length) / results.length)}%`;
    return reached.length === 0 ? 'never' : `${spread(reached, 0)}, ${share}`;
  };
  const policies = [
    'A4, FSRS-6',
    'A4, FSRS-7',
    'A4 + 1 min gap, FSRS-6',
    'A4 + 1 min gap, FSRS-7',
    'A4 without look-ahead, FSRS-7',
  ].map(variant);
  const rows: string[][] = [];
  for (const v of policies) {
    const [name] = v;
    for (const profile of ['beginner', 'knower', 'forgot'] as const) {
      const results = runs(factoryOf(v), SEEDS, DAYS, REFERENCE, profile);
      rows.push([
        name,
        profile,
        days(results, (r) => r.readsBasicDay),
        days(results, (r) => r.readsTrackDay),
        days(results, (r) => r.unlockedBasicDay),
        spread(
          results.map((r) => r.unlockedWeek),
          0,
        ),
        `${spread(
          results.map((r) => 100 * r.reviewRetention),
          1,
        )}%`,
        `${spread(
          results.map((r) => 100 * r.nextDay),
          0,
        )}%`,
        spread(
          results.map((r) => r.minutesPerDay),
          1,
        ),
        String(median(results.map((r) => r.reviews))),
      ]);
    }
  }
  console.log(`## Main table\n\n${SEEDS} seeds, ${DAYS} days.\n`);
  console.log(
    lines(
      [
        'policy',
        'learner',
        'reads 46 basic, day',
        'reads 104, day',
        'unlocked 46, day',
        'unlocked by day 7',
        'review retention',
        'next-day recall of a new kana',
        'min/day, days 1–14',
        'reviews',
      ],
      rows,
    ),
  );
}

const LEARNERS: readonly (readonly [string, ReferenceParams])[] = [
  ['reference', REFERENCE],
  ['recallGain ×0.5', { ...REFERENCE, recallGain: REFERENCE.recallGain * 0.5 }],
  ['gainExponent ×1.5', { ...REFERENCE, gainExponent: REFERENCE.gainExponent * 1.5 }],
  ['lapseKeep ×0.5', { ...REFERENCE, lapseKeep: REFERENCE.lapseKeep * 0.5 }],
  ['recallGain ×1.5', { ...REFERENCE, recallGain: REFERENCE.recallGain * 1.5 }],
];

if (want('planner')) {
  const SEEDS = Number(process.env['SEEDS'] ?? 30);
  const DAYS = 30;
  const rows = LEARNERS.map(([name, reference]) => [
    name,
    ...VARIANTS.map((v) => {
      const results = runs(factoryOf(v), SEEDS, DAYS, reference);
      const day = median(results.map((r) => r.readsBasicDay ?? DAYS + 1));
      const reads = day > DAYS ? `>${DAYS}` : String(day);
      const retention = (100 * median(results.map((r) => r.reviewRetention))).toFixed(1);
      const minutes = median(results.map((r) => r.minutesPerDay)).toFixed(1);
      return `${reads} / ${retention}% / ${minutes}`;
    }),
  ]);
  console.log(
    `\n## Planner\n\nThe beginner, ${SEEDS} seeds, ${DAYS} days. Cells: day the basic 46 are read / review retention / min a day (medians).\n`,
  );
  console.log(lines(['reference learner', ...VARIANTS.map(([name]) => name)], rows));
}

if (want('calibration')) {
  const SEEDS = Number(process.env['SEEDS'] ?? 10);
  const DAYS = 30;
  const BUCKETS = [0, 0.5, 0.7, 0.8, 0.9, 1.0001];
  interface Point {
    readonly p: number;
    readonly ok: boolean;
  }
  const describe = (points: readonly Point[]): string[] => {
    const n = points.length;
    if (n === 0) return ['0', '—', '—', '—'];
    const mean = points.reduce((a, x) => a + x.p, 0) / n;
    const actual = points.filter((x) => x.ok).length / n;
    const logLoss =
      -points.reduce((a, x) => {
        const p = Math.min(1 - 1e-6, Math.max(1e-6, x.p));
        return a + Math.log(x.ok ? p : 1 - p);
      }, 0) / n;
    return [
      String(n),
      `${(100 * mean).toFixed(1)}%`,
      `${(100 * actual).toFixed(1)}%`,
      logLoss.toFixed(3),
    ];
  };
  const rows: string[][] = [];
  const summary: string[][] = [];
  for (const [learner, reference] of LEARNERS.slice(0, 2)) {
    for (const [driver, driverParams, driverModel] of ['A4, FSRS-6', 'A4 + 1 min gap, FSRS-7'].map(
      variant,
    )) {
      // The answers of one planner, replayed under each model.
      const logs: Answer[][] = [];
      for (let seed = 1; seed <= SEEDS; seed += 1) {
        const rec = recording(driverParams, driverModel);
        simulate(rec.factory, 'beginner', seed, DAYS, reference);
        logs.push(rec.answers);
      }
      for (const [judge, judgeModel] of MODELS) {
        const groups: Record<'overnight' | 'later same day' | 'scheduled reviews', Point[]> = {
          overnight: [],
          'later same day': [],
          'scheduled reviews': [],
        };
        for (const log of logs) {
          const planner = createFsrsPlanner(PLANNER_A4, judgeModel)(hiraganaItems(), createRng(1));
          const lastAt = new Map<number, number>();
          for (const answer of log) {
            const { item, kind, review } = answer.task;
            const prev = lastAt.get(item);
            if (kind === 'recall' && prev !== undefined) {
              const point = { p: planner.predict(item, answer.at), ok: answer.ok };
              const sameDay = Math.floor(prev / DAY_MS) === Math.floor(answer.at / DAY_MS);
              if (!sameDay) groups.overnight.push(point);
              else if (answer.at - prev >= 3_600_000) groups['later same day'].push(point);
              if (review) groups['scheduled reviews'].push(point);
            }
            planner.apply(answer);
            lastAt.set(item, answer.at);
          }
        }
        for (const [group, points] of Object.entries(groups)) {
          summary.push([learner, driver, judge, group, ...describe(points)]);
        }
        for (let b = 0; b + 1 < BUCKETS.length; b += 1) {
          const lo = BUCKETS[b] ?? 0;
          const hi = BUCKETS[b + 1] ?? 1;
          const points = groups.overnight.filter((x) => x.p >= lo && x.p < hi);
          rows.push([
            learner,
            driver,
            judge,
            `${lo.toFixed(1)}–${Math.min(1, hi).toFixed(1)}`,
            ...describe(points).slice(0, 3),
          ]);
        }
      }
    }
  }
  console.log(
    `\n## Calibration\n\nThe beginner, ${SEEDS} seeds, ${DAYS} days. The answers of a planner (the driver), replayed under each model (the judge); a point is a recall on a kana seen before, with the judge's predicted recall just before it. Overnight: the previous exposure was on an earlier day. Later same day: at least an hour after it, the same day. Scheduled reviews: tasks the driver scheduled as reviews.\n`,
  );
  console.log(
    lines(
      [
        'learner',
        'answers of',
        'judge',
        'group',
        'answers',
        'mean predicted',
        'correct',
        'log loss',
      ],
      summary,
    ),
  );
  console.log('\nOvernight answers by the predicted recall:\n');
  console.log(
    lines(
      ['learner', 'answers of', 'judge', 'predicted', 'answers', 'mean predicted', 'correct'],
      rows,
    ),
  );
}

if (want('forecast')) {
  const SEEDS = Number(process.env['SEEDS'] ?? 20);
  const estimators: readonly Estimator[] = [
    'all sessions',
    'forward',
    'forward, observed',
    'forward, corrected',
  ];
  const accuracy = (outcomes: readonly Outcome[]): string => {
    if (outcomes.length === 0) return '—';
    const share = (ok: (o: Outcome) => boolean): number =>
      Math.round((100 * outcomes.filter(ok).length) / outcomes.length);
    const abs = median(outcomes.map((o) => Math.abs(o.forecast - o.actual)));
    const bias = median(outcomes.map((o) => o.forecast - o.actual));
    const within1 = share((o) => Math.abs(o.forecast - o.actual) <= 1);
    const within25 = share((o) => Math.abs(o.forecast - o.actual) <= 0.25 * o.actual);
    const covered =
      outcomes[0]?.low === undefined
        ? '—'
        : `${share((o) => o.actual >= (o.low ?? 0) && o.actual <= (o.high ?? 0))}%`;
    return `${abs} / ${bias} / ${within1}% / ${within25}% / ${covered}`;
  };
  const rows: string[][] = [];
  for (const [learner, reference] of LEARNERS.slice(0, 2)) {
    for (const v of ['A4, FSRS-6', 'A4, FSRS-7', 'A4 + 1 min gap, FSRS-7'].map(variant)) {
      const [name] = v;
      const results = runs(factoryOf(v), SEEDS, 30, reference, 'beginner', 10);
      for (const target of ['row', 'basic'] as const) {
        rows.push([
          learner,
          name,
          target === 'row' ? 'next row' : '46 basic',
          ...estimators.map((e) => accuracy(results.flatMap((r) => r.forecasts[e][target]))),
        ]);
      }
    }
  }
  console.log(
    `\n## Forecasts\n\nThe beginner, ${SEEDS} seeds, 30 days, forecasts at the first session of each day. Cells: median |error| in sessions / median signed error / within ±1 / within ±25% / actual inside the 10–90% range.\n`,
  );
  console.log(lines(['learner', 'planner', 'target', ...estimators], rows));
}

if (want('rebuild')) {
  const items = hiraganaItems();
  const timings: string[][] = [];
  // One log for both models: the 60 days of one beginner under A4 on FSRS-6.
  const rec = recording(PLANNER_A4, FSRS6_MODEL);
  simulate(rec.factory, 'beginner', 1, 60);
  for (const copies of [1, 10, 30]) {
    const log = Array.from({ length: copies }, (_, k) =>
      rec.answers.map((a) => ({ ...a, at: a.at + k * 60 * DAY_MS })),
    ).flat();
    for (const [name, model] of MODELS) {
      const samples: number[] = [];
      for (let repeat = 0; repeat < 5; repeat += 1) {
        const planner = createFsrsPlanner(PLANNER_A4, model)(items, createRng(2));
        const t = performance.now();
        planner.adopt(freshCore(items, PLANNER_A4.goal));
        for (const answer of log) planner.apply(answer);
        samples.push(performance.now() - t);
      }
      timings.push([name, String(log.length), `${median(samples).toFixed(1)} ms`]);
    }
  }
  console.log(
    '\n## Rebuild\n\nA fresh A4 planner on each model applies the same log: the 60 days of one beginner under A4 on FSRS-6, repeated with shifted times; the median of 5 timings in Node on this machine.\n',
  );
  console.log(lines(['model', 'answers', 'time'], timings));
}

if (want('mastery')) {
  const SEEDS = Number(process.env['SEEDS'] ?? 20);
  const s90 = (model: MemoryModel, memory: Memory): number =>
    model === FSRS7_MODEL ? FSRS7.intervalFor(memory, 0.9) : memory.stability;
  const rows: string[][] = [];
  for (const [name, params, model] of ['A4, FSRS-6', 'A4, FSRS-7', 'A4 + 1 min gap, FSRS-7'].map(
    variant,
  )) {
    for (const day of [14, 30, 60]) {
      const counts: Record<'learned' | 's' | 's90', number[]> = { learned: [], s: [], s90: [] };
      for (let seed = 1; seed <= SEEDS; seed += 1) {
        const rec = recording(params, model);
        simulate(rec.factory, 'beginner', seed, day);
        const states = rec.planner()?.snapshot().states ?? [];
        const learned = states.filter((s) => s.phase === 'graduated' && s.memory !== undefined);
        counts.learned.push(learned.length);
        counts.s.push(learned.filter((s) => (s.memory?.stability ?? 0) >= 21).length);
        counts.s90.push(
          learned.filter((s) => s.memory !== undefined && s90(model, s.memory) >= 21).length,
        );
      }
      rows.push([
        name,
        String(day),
        String(median(counts.learned)),
        String(median(counts.s)),
        String(median(counts.s90)),
      ]);
    }
  }
  console.log(
    `\n## Mastered\n\nThe beginner, ${SEEDS} seeds. Learned kana at the end of a day, and those of them with a stability (the slow one for FSRS-7) of at least 21 days, or with at least 21 days until the predicted recall falls to 0.90 (S90; the same as the stability for FSRS-6).\n`,
  );
  console.log(lines(['planner', 'day', 'learned', 'stability ≥ 21 d', 'S90 ≥ 21 d'], rows));
}
