import { dayStart, localDay } from '@/entities/learn';
import { HALF_DAY_MS, MIN_DAYS_ALL } from './days';
import type { Period } from './days';

/** One bar of the answer-time chart: the middle half of a day (or week) and its median. */
export type ChartRange = {
  readonly x: number;
  readonly lo: number;
  readonly hi: number;
  readonly mid: number;
  /** The tooltip lines; called only for the bar under the cursor. */
  readonly tip: () => readonly string[];
};

export type Axis = {
  readonly domain: readonly [number, number];
  readonly ticks: readonly number[];
};

export type TimeAxis = {
  readonly domain: readonly [number, number];
  readonly ticks: readonly { readonly x: number; readonly label: string }[];
  readonly days: number;
};

const MAX_INTERVALS = 4;

/**
 * An axis over `lo`…`hi`: the smallest of `steps` (ascending) for which the domain snapped out to
 * that step has at most four intervals, the largest when none fits. The domain ends on ticks and
 * every tick is returned.
 */
export function axisOf(lo: number, hi: number, steps: readonly number[]): Axis {
  let step = steps[steps.length - 1] ?? 1;
  let bottom = Math.floor(lo / step) * step;
  let top = Math.ceil(hi / step) * step;
  for (const candidate of steps) {
    const floor = Math.floor(lo / candidate) * candidate;
    const ceil = Math.ceil(hi / candidate) * candidate;
    if ((ceil - floor) / candidate <= MAX_INTERVALS) {
      step = candidate;
      bottom = floor;
      top = ceil;
      break;
    }
  }
  const ticks: number[] = [];
  for (let tick = bottom; tick <= top; tick += step) ticks.push(tick);
  return { domain: [bottom, top], ticks };
}

function tickStep(days: number): number {
  if (days <= 7) return 1;
  if (days <= 14) return 2;
  if (days <= 35) return 7;
  return Math.ceil(days / 35) * 7;
}

/**
 * The time axis: from the start of the first day of the period to the end of `today`; for `'all'`
 * from the first result's day, at least 14 days. Ticks sit in the middle of a day, counted back
 * from today, with a step that doubles when `narrow`.
 */
export function timeAxis(
  period: Period,
  firstAt: number,
  today: number,
  narrow: boolean,
  format: (ms: number) => string,
): TimeAxis {
  const span =
    period === 'all' ? Math.max(MIN_DAYS_ALL, today - localDay(firstAt) + 1) : Number(period);
  const first = today - span + 1;
  const step = tickStep(span) * (narrow ? 2 : 1);
  const ticks: { x: number; label: string }[] = [];
  for (let day = today; day >= first; day -= step) {
    const x = dayStart(day) + HALF_DAY_MS;
    ticks.unshift({ x, label: format(x) });
  }
  return { domain: [dayStart(first), dayStart(today + 1)], ticks, days: span };
}
