export type DailyMedian = { readonly day: number; readonly ms: number };

export type MedianSeries = {
  // The local day of each point, consecutive.
  readonly days: readonly number[];
  // The daily median of each day; `null` for a day without answers: a gap, never an invented value.
  readonly values: readonly (number | null)[];
};

/** The days shown: the last month. */
export const SERIES_DAYS = 30;

/**
 * The points of the chart: every local day from the first one with answers (at most `SERIES_DAYS`
 * days back) to `today`, with `null` for a day without answers. No answers at all gives today alone.
 */
export function medianSeries(
  points: readonly DailyMedian[],
  today: number,
  span: number = SERIES_DAYS,
): MedianSeries {
  const byDay = new Map(points.map((point) => [point.day, point.ms]));
  const first = points[0]?.day ?? today;
  const from = Math.max(today - span + 1, Math.min(first, today));
  const days: number[] = [];
  const values: (number | null)[] = [];
  for (let day = from; day <= today; day++) {
    days.push(day);
    values.push(byDay.get(day) ?? null);
  }
  return { days, values };
}

export type Axis = {
  readonly domain: readonly [number, number];
  readonly ticks: readonly number[];
};

const STEP_MS = 500;

/**
 * The y axis in steps of 500 ms around the values and the target, with the target never on the
 * edge: `[1000, 2000]` for values of 1100 to 1400 and a target of 1500.
 */
export function medianAxis(values: readonly (number | null)[], targetMs: number): Axis {
  const known = values.filter((value): value is number => value !== null);
  const low = Math.min(targetMs, ...known);
  const high = Math.max(targetMs, ...known);
  const lo = Math.max(0, Math.floor(low / STEP_MS) * STEP_MS);
  const hi = (Math.floor(high / STEP_MS) + 1) * STEP_MS;
  return { domain: [lo, hi], ticks: [lo, (lo + hi) / 2, hi] };
}
