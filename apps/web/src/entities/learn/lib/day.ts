const DAY_MS = 86_400_000;

/** The local calendar day: days from 1970-01-01 to the date in the device's time zone. */
export function localDay(ms: number): number {
  const date = new Date(ms);
  return Math.round(Date.UTC(date.getFullYear(), date.getMonth(), date.getDate()) / DAY_MS);
}

/** The start (local midnight) of a local calendar day, Unix ms. */
export function dayStart(day: number): number {
  const date = new Date(day * DAY_MS);
  return new Date(date.getUTCFullYear(), date.getUTCMonth(), date.getUTCDate()).getTime();
}
