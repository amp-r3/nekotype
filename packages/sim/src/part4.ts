import { performance } from 'node:perf_hooks';
import { simulateDevices } from './devices';
import type { DevicesResult, Strategy } from './devices';
import { hiraganaItems } from './items';
import { REFERENCE } from './learner';
import type { ReferenceParams } from './learner';
import { createFsrsPlanner, freshCore, PLANNER_A4 } from './policies/fsrs-planner';
import type { PlannerParams } from './policies/fsrs-planner';
import type { Answer } from './policy';
import { createRng } from './rng';
import { simulate } from './run';
import type { Estimator, Outcome, RunResult, SimOptions } from './run';

/**
 * The tables of part 4 of the research note: forward forecasts, grading, katakana and composites,
 * and the merge across devices. `PART=forecast|grading|katakana|parts|devices` picks one table.
 */

const SEEDS = Number(process.env['SEEDS'] ?? 20);
const PART = process.env['PART'];
const want = (part: string): boolean => PART === undefined || PART === part;

function median(values: readonly number[]): number {
  const sorted = [...values].sort((a, b) => a - b);
  return sorted[Math.floor(sorted.length / 2)] ?? Number.NaN;
}

function runs(
  params: PlannerParams,
  reference: ReferenceParams,
  days: number,
  options: SimOptions = {},
): RunResult[] {
  return Array.from({ length: SEEDS }, (_, seed) =>
    simulate(createFsrsPlanner(params), 'beginner', seed + 1, days, reference, options),
  );
}

function dayCell(
  results: readonly RunResult[],
  pick: (r: RunResult) => number | undefined,
  days: number,
): string {
  const day = median(results.map((r) => pick(r) ?? days + 1));
  return day > days ? `>${days}` : String(day);
}

function lines(header: readonly string[], rows: readonly (readonly string[])[]): string {
  return [
    `| ${header.join(' | ')} |`,
    `|${' --- |'.repeat(header.length)}`,
    ...rows.map((row) => `| ${row.join(' | ')} |`),
  ].join('\n');
}

const SLOW: ReferenceParams = { ...REFERENCE, recallGain: REFERENCE.recallGain * 0.5 };

if (want('forecast')) {
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
  for (const [learner, reference] of [
    ['reference', REFERENCE],
    ['recallGain ×0.5', SLOW],
  ] as const) {
    const results = runs(PLANNER_A4, reference, 30, { forward: 10, daily: true });
    for (const target of ['row', 'basic'] as const) {
      rows.push([
        learner,
        target === 'row' ? 'next row' : '46 basic',
        ...estimators.map((e) => accuracy(results.flatMap((r) => r.forecasts[e][target]))),
      ]);
    }
  }
  console.log('## Forecasts\n');
  console.log(
    'A4, forecasts at the first session of each day. Cells: median |error| in sessions / median signed error / within ±1 / within ±25% / actual inside the 10–90% range.\n',
  );
  console.log(lines(['learner', 'target', ...estimators], rows));
}

if (want('grading')) {
  const gradings: readonly PlannerParams['grading'][] = [
    'time',
    'binary',
    'recognition good',
    'recognition none',
  ];
  const learners: readonly (readonly [string, ReferenceParams])[] = [
    ['reference', REFERENCE],
    ['recallGain ×0.5', SLOW],
    ['recognitionShare ×0.5', { ...REFERENCE, recognitionShare: 0.2 }],
    ['familiarity ×1.5', { ...REFERENCE, familiarity: 0.45 }],
  ];
  const rows = learners.map(([name, reference]) => [
    name,
    ...gradings.map((grading) => {
      const results = runs({ ...PLANNER_A4, grading }, reference, 30);
      const retention = (100 * median(results.map((r) => r.reviewRetention))).toFixed(1);
      const minutes = median(results.map((r) => r.minutesPerDay)).toFixed(1);
      return `${dayCell(results, (r) => r.readsBasicDay, 30)} / ${retention}% / ${minutes}`;
    }),
  ]);
  console.log('\n## Grading\n');
  console.log('A4, 30 days. Cells: day the basic 46 are read / review retention / min a day.\n');
  console.log(lines(['reference learner', ...gradings], rows));
}

if (want('katakana')) {
  const DAYS = 60;
  const variants: readonly (readonly [string, Partial<PlannerParams>])[] = [
    ['after hiragana', { katakana: 'after hiragana' }],
    ['after basic', { katakana: 'after basic' }],
    ['after basic, link', { katakana: 'after basic', link: true }],
    ['paired', { katakana: 'paired' }],
    ['paired, link', { katakana: 'paired', link: true }],
  ];
  const rows: string[][] = [];
  for (const transfer of [0, 1]) {
    for (const [name, extra] of variants) {
      const results = runs({ ...PLANNER_A4, ...extra }, { ...REFERENCE, transfer }, DAYS, {
        tracks: 'both',
      });
      rows.push([
        String(transfer),
        name,
        dayCell(results, (r) => r.readsBasicDay, DAYS),
        dayCell(results, (r) => r.readsKatakanaDay, DAYS),
        dayCell(results, (r) => r.unlockedKatakanaDay, DAYS),
        dayCell(results, (r) => r.readsTrackDay, DAYS),
        `${(100 * median(results.map((r) => r.reviewRetention))).toFixed(1)}%`,
        median(results.map((r) => r.minutesPerDay)).toFixed(1),
      ]);
    }
  }
  console.log('\n## Katakana\n');
  console.log(
    'A4 with both tracks (229 kana), 60 days. Transfer: how much more stability a katakana gets at its first study when its hiragana is recalled (0: none, 1: twice).\n',
  );
  console.log(
    lines(
      [
        'transfer',
        'katakana',
        'reads 46 hiragana, day',
        'reads 46 katakana, day',
        'unlocked 46 katakana, day',
        'reads all 229, day',
        'review retention',
        'min/day, days 1–14',
      ],
      rows,
    ),
  );
}

if (want('parts')) {
  const DAYS = 30;
  const rows: string[][] = [];
  for (const partsShare of [0, 0.3]) {
    for (const creditParts of [false, true]) {
      const results = runs({ ...PLANNER_A4, creditParts }, { ...REFERENCE, partsShare }, DAYS);
      rows.push([
        String(partsShare),
        creditParts ? 'yes' : 'no',
        dayCell(results, (r) => r.readsBasicDay, DAYS),
        dayCell(results, (r) => r.readsTrackDay, DAYS),
        `${(100 * median(results.map((r) => r.reviewRetention))).toFixed(1)}%`,
        median(results.map((r) => r.minutesPerDay)).toFixed(1),
        String(median(results.map((r) => r.reviews))),
      ]);
    }
  }
  console.log('\n## Credit to parts\n');
  console.log(
    'A4, 30 days. Parts share: how much a correct recall of a composite strengthens its parts in the reference learner. Credit: the planner counts it as a hard review of each learned part.\n',
  );
  console.log(
    lines(
      [
        'parts share',
        'credit',
        'reads 46 basic, day',
        'reads 104, day',
        'review retention',
        'min/day',
        'reviews',
      ],
      rows,
    ),
  );
}

if (want('devices')) {
  const strategies: readonly Strategy[] = ['one device', 'answer log', 'last state'];
  const rows: string[][] = [];
  for (const offline of [0, 0.3, 0.6]) {
    for (const strategy of strategies) {
      const results: DevicesResult[] = Array.from({ length: SEEDS }, (_, seed) =>
        simulateDevices(strategy, seed + 1, 30, offline),
      );
      rows.push([
        `${Math.round(offline * 100)}%`,
        strategy,
        String(median(results.map((r) => r.readsBasicDay ?? 31))),
        `${(100 * median(results.map((r) => r.reviewRetention))).toFixed(1)}%`,
        median(results.map((r) => r.minutesPerDay)).toFixed(1),
        `${(100 * median(results.map((r) => r.stabilityError))).toFixed(1)}% / ${(100 * median(results.map((r) => r.stabilityError90))).toFixed(1)}%`,
        String(median(results.map((r) => r.phaseErrors))),
      ]);
    }
  }
  console.log('\n## Devices\n');
  console.log(
    'A4, 30 days, the morning sitting on one device and the evening on another. Offline: chance that a sync fails. Stability error: |ln(S / S of the full log)| after the final sync, median over kana / 90th percentile.\n',
  );
  console.log(
    lines(
      [
        'offline',
        'merge',
        'reads 46 basic, day',
        'review retention',
        'min/day',
        'stability error',
        'phase errors',
      ],
      rows,
    ),
  );

  // The cost of a rebuild: a fresh planner applies a log of answers.
  const items = hiraganaItems();
  const seedRun: Answer[] = [];
  simulate(
    (its, rng) => {
      const planner = createFsrsPlanner(PLANNER_A4)(its, rng);
      return {
        ...planner,
        session(now, first) {
          const session = planner.session(now, first);
          return {
            ...session,
            record(answer: Answer) {
              seedRun.push(answer);
              session.record(answer);
            },
          };
        },
      };
    },
    'beginner',
    1,
    60,
  );
  const timings: string[] = [];
  for (const copies of [1, 10, 30]) {
    const log = Array.from({ length: copies }, (_, k) =>
      seedRun.map((a) => ({ ...a, at: a.at + k * 60 * 86_400_000 })),
    ).flat();
    const planner = createFsrsPlanner(PLANNER_A4)(items, createRng(2));
    const t = performance.now();
    planner.adopt(freshCore(items, PLANNER_A4.goal));
    for (const answer of log) planner.apply(answer);
    timings.push(`${log.length} answers: ${(performance.now() - t).toFixed(1)} ms`);
  }
  console.log(`\nRebuild from the log on this machine (Node): ${timings.join('; ')}.`);
}
