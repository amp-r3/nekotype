import { describe, it, expect, vi, afterEach } from 'vitest';
import { defaultClock } from './clock';

afterEach(() => {
  vi.restoreAllMocks();
});

describe('defaultClock', () => {
  it('does not go back when the system clock is set back', () => {
    const before = defaultClock.now();
    // The wall clock jumps back by a second, as after a time sync or a resume from sleep.
    vi.spyOn(Date, 'now').mockReturnValue(Date.now() - 1000);
    expect(defaultClock.now()).toBeGreaterThanOrEqual(before);
  });

  it('stays close to the wall clock in magnitude', () => {
    expect(Math.abs(defaultClock.now() - Date.now())).toBeLessThan(5000);
  });
});
