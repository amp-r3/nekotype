import { performance } from 'node:perf_hooks';
import { foldLog } from '@nekotype/model';
import { syntheticLog } from '@nekotype/model/testing';
import { createFsrsPlanner, PLANNER_A4 } from './policies/fsrs-planner';
import { createProductionPolicy } from './policies/production';
import { REFERENCE } from './learner';
import type { Profile, ReferenceParams } from './learner';
import { simulate } from './run';
import type { Outcome, PolicyFactory, RunResult } from './run';

/**
 * The acceptance tables of P7 on the production model (`@nekotype/model`): `PART=main|planner|
 * forecast|cost` picks one; without it all are printed. The research policies stay, so parts 1–5
 * still reproduce; the numbers of the P7 plan come from this script only.
 */

const PART = process.env['PART'];
const want = (part: string): boolean => PART === undefined || PART === part;

const PRODUCTION = createProductionPolicy();

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
): RunResult[] {
  return Array.from({ length: seeds }, (_, seed) =>
    simulate(factory, profile, seed + 1, days, reference),
  );
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
  const rows: string[][] = [];
  for (const profile of ['beginner', 'knower', 'forgot'] as const) {
    const results = runs(PRODUCTION, SEEDS, DAYS, REFERENCE, profile);
    rows.push([
      'production model',
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
  const COLUMNS: readonly (readonly [string, PolicyFactory])[] = [
    ['A4, research policy', createFsrsPlanner(PLANNER_A4)],
    ['production model', PRODUCTION],
  ];
  const rows = LEARNERS.map(([name, reference]) => [
    name,
    ...COLUMNS.map(([, factory]) => {
      const results = runs(factory, SEEDS, DAYS, reference);
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
  console.log(lines(['reference learner', ...COLUMNS.map(([name]) => name)], rows));
}

if (want('forecast')) {
  const SEEDS = Number(process.env['SEEDS'] ?? 20);
  const DAYS = 30;
  const share = (outcomes: readonly Outcome[], ok: (o: Outcome) => boolean): number =>
    Math.round((100 * outcomes.filter(ok).length) / outcomes.length);
  const cell = (outcomes: readonly Outcome[]): string => {
    if (outcomes.length === 0) return '—';
    const abs = median(outcomes.map((o) => Math.abs(o.forecast - o.actual)));
    const bias = median(outcomes.map((o) => o.forecast - o.actual));
    const within1 = share(outcomes, (o) => Math.abs(o.forecast - o.actual) <= 1);
    const within25 = share(outcomes, (o) => Math.abs(o.forecast - o.actual) <= 0.25 * o.actual);
    const covered =
      outcomes[0]?.low === undefined
        ? '—'
        : `${share(outcomes, (o) => o.actual >= (o.low ?? 0) && o.actual <= (o.high ?? 0))}%`;
    return `${abs} / ${bias} / ${within1}% / ${within25}% / ${covered}`;
  };
  const columns = ['forward, observed', 'forward, corrected'] as const;
  const rows = (
    [
      ['reference', REFERENCE],
      ['recallGain ×0.5', { ...REFERENCE, recallGain: REFERENCE.recallGain * 0.5 }],
    ] as const
  ).map(([name, reference]) => {
    const results = Array.from({ length: SEEDS }, (_, seed) =>
      simulate(PRODUCTION, 'beginner', seed + 1, DAYS, reference, { forward: 1, daily: true }),
    );
    return [
      name,
      'next row',
      ...columns.map((column) => cell(results.flatMap((r) => r.forecasts[column].row))),
    ];
  });
  console.log(
    `\n## Forecast\n\nThe production model's forecast of the next row, ${SEEDS} seeds, ${DAYS} days, made at the first session of each day. Cells: median |error| in sessions / median signed error / within ±1 / within ±25% / actual inside the 10–90% range. "Observed" is the raw median (what the history keeps), "corrected" the one the app shows.\n`,
  );
  console.log(lines(['learner', 'target', ...columns], rows));
}

if (want('cost')) {
  const events = syntheticLog({ answers: 40_000, seed: 1 });
  const timings: number[] = [];
  for (let run = 0; run < 6; run += 1) {
    const t = performance.now();
    foldLog(events, { targetMs: 1500, stats: true });
    if (run > 0) timings.push(performance.now() - t);
  }
  console.log(
    `\n## Cost\n\nfoldLog of ${events.length} events (40,000 answers, both tracks) in Node: ${timings.map((v) => v.toFixed(1)).join(', ')} ms (median ${median(timings).toFixed(1)}). The gate is Chromium at 4×: apps/web/e2e/model-cost.spec.ts.`,
  );
}
