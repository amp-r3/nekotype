import { REFERENCE } from './learner';
import type { Profile, ReferenceParams } from './learner';
import { createCurrentPolicy } from './policies/current';
import {
  createFsrsPlanner,
  FSRS_GRID,
  HALF_LIFE_GRID,
  HALF_LIFE_MODEL,
  PLANNER_A2,
  PLANNER_A4,
} from './policies/fsrs-planner';
import type { PlannerParams } from './policies/fsrs-planner';
import { ESTIMATORS, simulate } from './run';
import type { Outcome, PolicyFactory, RunResult } from './run';

/**
 * The tables of part 3 of the research note: planners that look ahead to the next session or adapt
 * to the observed review retention, memory models fitted to the learner, and the accuracy of
 * forecasts in sessions. `PART=planner|fit|forecast` picks one table; without it all are printed.
 */

const SEEDS = Number(process.env['SEEDS'] ?? 30);
const DAYS = 30;
const PART = process.env['PART'];

const LEARNERS: readonly (readonly [string, ReferenceParams])[] = [
  ['reference', REFERENCE],
  ['recallGain ×0.5', { ...REFERENCE, recallGain: REFERENCE.recallGain * 0.5 }],
  ['gainExponent ×1.5', { ...REFERENCE, gainExponent: REFERENCE.gainExponent * 1.5 }],
  ['lapseKeep ×0.5', { ...REFERENCE, lapseKeep: REFERENCE.lapseKeep * 0.5 }],
  ['recallGain ×1.5', { ...REFERENCE, recallGain: REFERENCE.recallGain * 1.5 }],
];

function median(values: readonly number[]): number {
  const sorted = [...values].sort((a, b) => a - b);
  return sorted[Math.floor(sorted.length / 2)] ?? Number.NaN;
}

function runs(
  factory: PolicyFactory,
  reference: ReferenceParams,
  profile: Profile = 'beginner',
): RunResult[] {
  return Array.from({ length: SEEDS }, (_, seed) =>
    simulate(factory, profile, seed + 1, DAYS, reference),
  );
}

function cell(results: readonly RunResult[]): string {
  const day = median(results.map((r) => r.readsBasicDay ?? DAYS + 1));
  const reads = day > DAYS ? `>${DAYS}` : String(day);
  const retention = (100 * median(results.map((r) => r.reviewRetention))).toFixed(1);
  const minutes = median(results.map((r) => r.minutesPerDay)).toFixed(1);
  return `${reads} / ${retention}% / ${minutes}`;
}

function table(policies: readonly (readonly [string, PolicyFactory])[]): string {
  const header = ['reference learner', ...policies.map(([name]) => name)];
  const lines = [`| ${header.join(' | ')} |`, `|${' --- |'.repeat(header.length)}`];
  for (const [name, reference] of LEARNERS) {
    const cells = policies.map(([, factory]) => cell(runs(factory, reference)));
    lines.push(`| ${[name, ...cells].join(' | ')} |`);
  }
  return lines.join('\n');
}

const planner = (extra: Partial<PlannerParams>): PolicyFactory =>
  createFsrsPlanner({ ...PLANNER_A2, ...extra });

const CELLS = 'Cells: day the basic 46 are read / review retention / minutes a day (medians).\n';

if (PART === undefined || PART === 'planner') {
  console.log(`## Planner\n\n${CELLS}`);
  console.log(
    table([
      ['current rule', createCurrentPolicy],
      ['A2', createFsrsPlanner(PLANNER_A2)],
      ['A2, adapt 0.05', planner({ adapt: 0.05 })],
      ['A2, look-ahead', planner({ horizon: 'observed' })],
      ['A2, look-ahead, retention 0.90', planner({ horizon: 'observed', retention: 0.9 })],
      ['A4: look-ahead, 0.90, adapt 0.05', createFsrsPlanner(PLANNER_A4)],
      ['A4 with 0.93', createFsrsPlanner({ ...PLANNER_A4, retention: 0.93 })],
    ]),
  );
}

if (PART === undefined || PART === 'fit') {
  console.log(`\n## Fitting\n\n${CELLS}`);
  const fitted = (fitOn: 'recalls' | 'reviews', fitAfter: number): PlannerParams => ({
    ...PLANNER_A4,
    fit: FSRS_GRID,
    fitOn,
    fitAfter,
  });
  console.log(
    table([
      ['A2', createFsrsPlanner(PLANNER_A2)],
      ['A2, fit on recalls', planner({ fit: FSRS_GRID })],
      ['A4', createFsrsPlanner(PLANNER_A4)],
      ['A4, fit on recalls', createFsrsPlanner(fitted('recalls', 100))],
      ['A4, fit on reviews', createFsrsPlanner(fitted('reviews', 50))],
      ['B4: half-life, A4 planner', createFsrsPlanner(PLANNER_A4, HALF_LIFE_MODEL)],
      [
        'B4, fit on recalls',
        createFsrsPlanner({ ...PLANNER_A4, fit: HALF_LIFE_GRID }, HALF_LIFE_MODEL),
      ],
    ]),
  );
  for (const [name, reference] of LEARNERS.slice(0, 3)) {
    const chosen = runs(createFsrsPlanner(fitted('recalls', 100)), reference).map((r) => r.fits);
    const counts = new Map<string, number>();
    for (const fits of chosen) {
      const model = (fits.at(-1) ?? 'none').replace(/^\d+: /u, '');
      counts.set(model, (counts.get(model) ?? 0) + 1);
    }
    const firstFit = median(chosen.map((fits) => Number(fits[0]?.split(':')[0] ?? DAYS + 1)));
    const top = [...counts].sort((a, b) => b[1] - a[1]).slice(0, 3);
    console.log(
      `\n${name}: first fit on day ${firstFit}; model at the end: ${top
        .map(([model, n]) => `${model} ×${n}`)
        .join('; ')}`,
    );
  }
}

function accuracy(outcomes: readonly Outcome[]): string {
  if (outcomes.length === 0) return '—';
  const share = (ok: (o: Outcome) => boolean): number =>
    Math.round((100 * outcomes.filter(ok).length) / outcomes.length);
  const abs = median(outcomes.map((o) => Math.abs(o.forecast - o.actual)));
  const within1 = share((o) => Math.abs(o.forecast - o.actual) <= 1);
  const within25 = share((o) => Math.abs(o.forecast - o.actual) <= 0.25 * o.actual);
  return `${abs} / ${within1}% / ${within25}%`;
}

if (PART === undefined || PART === 'forecast') {
  console.log('\n## Forecasts\n');
  console.log(
    'Cells: median |error| in sessions / share within ±1 session / share within ±25%; the next row, then all 46 basic.\n',
  );
  const header = ['policy', 'learner', 'tasks a session', ...ESTIMATORS];
  const lines = [`| ${header.join(' | ')} |`, `|${' --- |'.repeat(header.length)}`];
  const policies: readonly (readonly [string, PolicyFactory])[] = [
    ['current rule', createCurrentPolicy],
    ['A2', createFsrsPlanner(PLANNER_A2)],
    ['A4', createFsrsPlanner(PLANNER_A4)],
  ];
  for (const [name, factory] of policies) {
    for (const [learner, reference] of LEARNERS.slice(0, 2)) {
      const results = runs(factory, reference);
      const perSession = median(results.map((r) => r.tasks / Math.max(1, r.sessions)));
      const cells = ESTIMATORS.map((estimator) => {
        const of = (pick: 'row' | 'basic'): string =>
          accuracy(results.flatMap((r) => r.forecasts[estimator][pick]));
        return `${of('row')}; ${of('basic')}`;
      });
      lines.push(`| ${[name, learner, perSession.toFixed(0), ...cells].join(' | ')} |`);
    }
  }
  console.log(lines.join('\n'));
}
