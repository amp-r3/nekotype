import type { Clock } from '@nekotype/shared/types';

// Milliseconds on the same scale as `Date.now()`, but from the monotonic timer: the wall clock can
// be set back (a time sync, a resume from sleep), and a test whose keys were timed across such a
// step would end with a negative duration. The values are only compared with each other.
export const defaultClock: Clock = {
  now: () => performance.timeOrigin + performance.now(),
};
