import type { TestResult, TypingRecords } from '@nekotype/shared/types';
import { personalBestKey } from '@nekotype/shared/runtime';
import { dayStart, localDay } from '@/entities/learn';
import type { Axis } from './median-series';
import type { Period } from './selection';

export type ChartPoint = {
  readonly x: number;
  readonly y: number;
  readonly mark: 'best' | 'hollow' | null;
  readonly tip: readonly string[];
};

/** One point of the rolling median and the middle half of its window. */
export type TrendPoint = {
  readonly x: number;
  readonly y: number;
  readonly lo: number;
  readonly hi: number;
};

export type TimeAxis = {
  readonly domain: readonly [number, number];
  readonly ticks: readonly { readonly x: number; readonly label: string }[];
  readonly days: number;
};

const TEN = 10;
const MARGIN = 2;
const MIN_WIDTH = 20;
const STEPS = [1, 2, 5, 10, 20, 25, 50, 100];
const MAX_INTERVALS = 4;
const HALF_DAY_MS = 12 * 60 * 60 * 1000;
const MIN_DAYS_ALL = 14;

/**
 * The KPM axis: the values' own range rounded out to tens (a margin of 2 above the highest), at
 * least 20 wide and never below 0, then to a step that gives at most four intervals. A mark's
 * height is a position, so the axis is not forced to start at 0.
 */
export function kpmAxis(values: readonly number[]): Axis {
  const low = values.length === 0 ? 0 : Math.min(...values);
  const high = values.length === 0 ? 0 : Math.max(...values);
  let lo = Math.max(0, Math.floor(low / TEN) * TEN);
  let hi = Math.ceil((high + MARGIN) / TEN) * TEN;
  if (hi - lo < MIN_WIDTH) {
    lo = Math.max(0, lo - TEN);
    hi = Math.max(hi, lo + MIN_WIDTH);
  }
  let step = STEPS[STEPS.length - 1] ?? 100;
  for (const candidate of STEPS) {
    const floor = Math.floor(lo / candidate) * candidate;
    const ceil = Math.ceil(hi / candidate) * candidate;
    if ((ceil - floor) / candidate <= MAX_INTERVALS) {
      step = candidate;
      break;
    }
  }
  lo = Math.floor(lo / step) * step;
  hi = Math.ceil(hi / step) * step;
  const ticks: number[] = [];
  for (let tick = lo; tick <= hi; tick += step) ticks.push(tick);
  return { domain: [lo, hi], ticks };
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

/** One mark per result: `best` for the current personal best of its key, `hollow` for a repeat. */
export function trendPoints(
  selection: readonly TestResult[],
  records: TypingRecords,
  tip: (result: TestResult, mark: ChartPoint['mark']) => readonly string[],
): ChartPoint[] {
  return selection.map((result) => {
    const mark =
      records[personalBestKey(result)]?.best?.resultId === result.id
        ? 'best'
        : result.repeated
          ? 'hollow'
          : null;
    return { x: result.endedAt, y: Math.round(result.kpm), mark, tip: tip(result, mark) };
  });
}

const WINDOW = 10;
const FIRST_LINE = 5;

/** The `p`-quantile (0–1) by linear interpolation at `(n − 1) · p`; 0 for no values (S5). */
export function quantile(values: readonly number[], p: number): number {
  const sorted = [...values].sort((a, b) => a - b);
  const at = (sorted.length - 1) * p;
  const below = Math.floor(at);
  const lo = sorted[below];
  const hi = sorted[Math.ceil(at)];
  if (lo === undefined || hi === undefined) return 0;
  return lo + (hi - lo) * (at - below);
}

/**
 * The rolling median of the selection (oldest first) and its middle half: for result `i` the last
 * `min(10, i + 1)` values up to `i`. `null` for the first four results, so the line starts at the
 * fifth (S5).
 */
export function rolling(
  selection: readonly TestResult[],
  value: (result: TestResult) => number,
): (TrendPoint | null)[] {
  const values = selection.map(value);
  return selection.map((result, index) => {
    if (index < FIRST_LINE - 1) return null;
    const window = values.slice(Math.max(0, index + 1 - WINDOW), index + 1);
    return {
      x: result.endedAt,
      y: quantile(window, 0.5),
      lo: quantile(window, 0.25),
      hi: quantile(window, 0.75),
    };
  });
}

/** Few tests (decision 104): five slots, one tick per result at its index, labelled by its date. */
export function fewAxis(
  selection: readonly TestResult[],
  format: (ms: number) => string,
): { readonly domain: readonly [number, number]; readonly ticks: TimeAxis['ticks'] } {
  return {
    domain: [-0.5, 4.5],
    ticks: selection.map((result, index) => ({ x: index, label: format(result.endedAt) })),
  };
}
