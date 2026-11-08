// Answer time of a recall task (spec metrics.md, "Learning metrics", A37).

/** Answer times are capped when they are recorded. */
export const ANSWER_TIME_CAP_MS = 10_000;
/** K while fewer than `K_MIN_INTERVALS` typing intervals are recorded. */
export const DEFAULT_K_MS = 200;
export const K_MIN_INTERVALS = 20;
/** K is the median of this many latest intervals. */
export const K_WINDOW = 50;

/**
 * One key of a recall answer. `t` runs from showing the task. A rejected key and Esc are not
 * `accepted`.
 */
export type Keystroke = {
  readonly t: number;
  readonly accepted: boolean;
};

/** The median; the median of an even count is the mean of the two middle values. 0 when empty. */
export function median(values: readonly number[]): number {
  if (values.length === 0) return 0;
  const sorted = [...values].sort((a, b) => a - b);
  const mid = sorted.length >> 1;
  const upper = sorted[mid] ?? 0;
  if (sorted.length % 2 === 1) return upper;
  return ((sorted[mid - 1] ?? 0) + upper) / 2;
}

/** K of the device from its recorded typing intervals, oldest first. */
export function typingK(intervals: readonly number[]): number {
  if (intervals.length < K_MIN_INTERVALS) return DEFAULT_K_MS;
  return median(intervals.slice(-K_WINDOW));
}

/**
 * The typing intervals of one answer: the time between two consecutive accepted keystrokes with no
 * rejected key and no Esc between them.
 */
export function intervalsOf(keystrokes: readonly Keystroke[]): number[] {
  const intervals: number[] = [];
  let previous: number | null = null;
  for (const key of keystrokes) {
    if (!key.accepted) {
      previous = null;
      continue;
    }
    if (previous !== null) intervals.push(key.t - previous);
    previous = key.t;
  }
  return intervals;
}

/** `max(t_first, t_last − (n − 1) × K)`, capped. `k` is computed before the answer's own intervals. */
export function recallAnswerTime(keystrokes: readonly Keystroke[], k: number): number {
  const accepted = keystrokes.filter((key) => key.accepted);
  const first = accepted[0];
  const last = accepted[accepted.length - 1];
  if (first === undefined || last === undefined) return ANSWER_TIME_CAP_MS;
  const time = Math.max(first.t, last.t - (accepted.length - 1) * k);
  return Math.min(ANSWER_TIME_CAP_MS, Math.max(0, time));
}
