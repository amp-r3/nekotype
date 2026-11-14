import type { TestResult } from '@nekotype/shared/types';
import type { Axis } from './median-series';
import { kpmAxis, tickStepFor } from './trend';

export type Metric = 'kpm' | 'accuracy' | 'rejected' | 'hints';

export const METRIC_ORDER: readonly Metric[] = ['kpm', 'accuracy', 'rejected', 'hints'];

export type MetricSpec = {
  readonly value: (result: TestResult) => number;
  readonly format: (value: number) => string;
  readonly lowerIsBetter: boolean;
};

/** The share of rejected keystrokes, rounded to a percent. */
export function rejectedPercent(result: TestResult): number {
  return result.keystrokes === 0
    ? 0
    : Math.round((100 * result.rejectedKeystrokes) / result.keystrokes);
}

export const METRICS: Record<Metric, MetricSpec> = {
  kpm: { value: (r) => Math.round(r.kpm), format: String, lowerIsBetter: false },
  accuracy: {
    value: (r) => Math.round(100 * r.kanaAccuracy),
    format: (v) => `${v}%`,
    lowerIsBetter: false,
  },
  rejected: { value: rejectedPercent, format: (v) => `${v}%`, lowerIsBetter: true },
  hints: { value: (r) => r.assisted, format: String, lowerIsBetter: true },
};

const ACCURACY_FLOOR = 90;
const STEP = 5;

function ticksOf(lo: number, hi: number): Axis {
  const step = tickStepFor(lo, hi);
  const ticks: number[] = [];
  for (let tick = lo; tick <= hi; tick += step) ticks.push(tick);
  return { domain: [lo, hi], ticks };
}

/** The y axis of a metric: `kpm` as before, accuracy up to 100, the others from 0. */
export function metricAxis(metric: Metric, values: readonly number[]): Axis {
  const high = values.length === 0 ? 0 : Math.max(...values);
  const low = values.length === 0 ? 0 : Math.min(...values);
  switch (metric) {
    case 'kpm':
      return kpmAxis(values);
    case 'accuracy':
      return ticksOf(
        values.length === 0
          ? ACCURACY_FLOOR
          : Math.min(ACCURACY_FLOOR, Math.floor(low / STEP) * STEP),
        100,
      );
    case 'rejected':
      return ticksOf(0, Math.max(STEP, Math.ceil(high / STEP) * STEP));
    case 'hints':
      return ticksOf(0, Math.max(3, high));
  }
}
