export const HALF_DAY_MS = 12 * 60 * 60 * 1000;
export const DAY_MS = 2 * HALF_DAY_MS;
/** The shortest span of the `all` period, in days. */
export const MIN_DAYS_ALL = 14;

/** The Monday of the week of a local day (day 0, 1970-01-01, was a Thursday). */
export function mondayOf(day: number): number {
  return day - ((((day + 3) % 7) + 7) % 7);
}
