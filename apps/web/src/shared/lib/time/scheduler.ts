import type { Scheduler } from '@nekotype/shared/types';

export const defaultScheduler: Scheduler = {
  setTimeout: (fn, ms) => ({ id: setTimeout(fn, ms) }),
  clearTimeout: (handle) => {
    clearTimeout(handle.id);
  },
  setInterval: (fn, ms) => ({ id: setInterval(fn, ms) }),
  clearInterval: (handle) => {
    clearInterval(handle.id);
  },
};
