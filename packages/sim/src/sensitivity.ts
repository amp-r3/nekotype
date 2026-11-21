import { REFERENCE } from './learner';
import type { ReferenceParams } from './learner';
import { createCurrentPolicy } from './policies/current';
import { createFsrsPlanner, PLANNER_A2 } from './policies/fsrs-planner';
import { simulate } from './run';
import type { PolicyFactory, RunResult } from './run';

/**
 * The sensitivity table of the research note: each constant of the reference learner moved by
 * −50% and +50% (shares capped below 1), the beginner over 30 days.
 */

const SEEDS = Number(process.env['SEEDS'] ?? 30);
const DAYS = 30;
const KEYS: readonly (keyof ReferenceParams)[] = [
  'firstStability',
  'recallGain',
  'gainExponent',
  'recognitionShare',
  'lapseKeep',
  'familiarity',
];
const POLICIES: readonly (readonly [string, PolicyFactory])[] = [
  ['current rule', createCurrentPolicy],
  ['A2', createFsrsPlanner(PLANNER_A2)],
];

function median(values: readonly number[]): number {
  const sorted = [...values].sort((a, b) => a - b);
  return sorted[Math.floor(sorted.length / 2)] ?? Number.NaN;
}

function cell(results: readonly RunResult[]): string {
  const day = median(results.map((r) => r.readsBasicDay ?? DAYS + 1));
  const reads = day > DAYS ? `>${DAYS}` : String(day);
  const retention = (100 * median(results.map((r) => r.reviewRetention))).toFixed(1);
  const minutes = median(results.map((r) => r.minutesPerDay)).toFixed(1);
  return `${reads} / ${retention}% / ${minutes}`;
}

const variants: (readonly [string, ReferenceParams])[] = [['reference', REFERENCE]];
for (const key of KEYS) {
  for (const factor of [0.5, 1.5]) {
    const value = REFERENCE[key] * factor;
    const capped =
      key === 'recognitionShare' || key === 'lapseKeep' || key === 'familiarity'
        ? Math.min(0.95, value)
        : value;
    variants.push([`${key} ×${factor}`, { ...REFERENCE, [key]: capped }]);
  }
}

const header = ['reference learner', ...POLICIES.map(([name]) => name)];
const lines = [`| ${header.join(' | ')} |`, `|${' --- |'.repeat(header.length)}`];
for (const [name, reference] of variants) {
  const cells = POLICIES.map(([, factory]) =>
    cell(
      Array.from({ length: SEEDS }, (_, seed) =>
        simulate(factory, 'beginner', seed + 1, DAYS, reference),
      ),
    ),
  );
  lines.push(`| ${[name, ...cells].join(' | ')} |`);
}
console.log('Cells: day the basic 46 are read / review retention / minutes a day (medians).\n');
console.log(lines.join('\n'));
