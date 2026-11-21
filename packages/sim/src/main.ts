import type { Profile } from './learner';
import { createCurrentPolicy } from './policies/current';
import {
  createFsrsPlanner,
  HALF_LIFE_MODEL,
  PLANNER,
  PLANNER_A2,
  PLANNER_A4,
} from './policies/fsrs-planner';
import { simulate } from './run';
import type { PolicyFactory, RunResult } from './run';

/**
 * Prints the comparison table of the research note: the median and the 10th–90th percentiles over
 * seeds, and for a day the share of learners who reached it within the run.
 */

const SEEDS = Number(process.env['SEEDS'] ?? 50);
const DAYS = 60;
const PROFILES: readonly Profile[] = ['beginner', 'knower', 'forgot'];
const POLICIES: readonly (readonly [string, PolicyFactory])[] = [
  ['current rule', createCurrentPolicy],
  ['A: FSRS-6, retention 0.90', createFsrsPlanner()],
  ['A: FSRS-6, retention 0.95', createFsrsPlanner({ ...PLANNER, retention: 0.95 })],
  ['A2: FSRS-6, steps in time', createFsrsPlanner(PLANNER_A2)],
  ['B: half-life, steps in time', createFsrsPlanner(PLANNER_A2, HALF_LIFE_MODEL)],
  ['A4: A2, look-ahead, 0.90, adapt', createFsrsPlanner(PLANNER_A4)],
  ['B4: half-life, A4 planner', createFsrsPlanner(PLANNER_A4, HALF_LIFE_MODEL)],
];

function quantile(values: readonly number[], q: number): number {
  const sorted = [...values].sort((a, b) => a - b);
  if (sorted.length === 0) return Number.NaN;
  const pos = (sorted.length - 1) * q;
  const lo = sorted[Math.floor(pos)] ?? Number.NaN;
  const hi = sorted[Math.ceil(pos)] ?? lo;
  return lo + (hi - lo) * (pos - Math.floor(pos));
}

function spread(values: readonly number[], digits: number): string {
  const f = (v: number): string => v.toFixed(digits);
  return `${f(quantile(values, 0.5))} (${f(quantile(values, 0.1))}–${f(quantile(values, 0.9))})`;
}

function days(results: readonly RunResult[], pick: (r: RunResult) => number | undefined): string {
  const reached = results.flatMap((r) => {
    const v = pick(r);
    return v === undefined ? [] : [v];
  });
  const share = `${Math.round((100 * reached.length) / results.length)}%`;
  return reached.length === 0 ? 'never' : `${spread(reached, 0)}, ${share}`;
}

const header = [
  'policy',
  'learner',
  'reads 46 basic, day',
  'reads 104, day',
  'unlocked 46, day',
  'unlocked by day 7',
  'review retention',
  'next-day recall of a new kana',
  'min/day, days 1–14',
];
const lines = [`| ${header.join(' | ')} |`, `|${' --- |'.repeat(header.length)}`];
for (const [name, factory] of POLICIES) {
  for (const profile of PROFILES) {
    const results = Array.from({ length: SEEDS }, (_, seed) =>
      simulate(factory, profile, seed + 1, DAYS),
    );
    const cells = [
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
    ];
    lines.push(`| ${cells.join(' | ')} |`);
  }
}
console.log(lines.join('\n'));
