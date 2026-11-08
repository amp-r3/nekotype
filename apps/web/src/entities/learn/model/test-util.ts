import type { Clock, Rng, Scheduler, TimeoutHandle } from '@nekotype/shared/types';

export class TestClock implements Clock {
  constructor(public time = 1_700_000_000_000) {}
  now(): number {
    return this.time;
  }
  advance(ms: number): void {
    this.time += ms;
  }
}

/** Runs the pending timeouts by hand, so a test sees what is deferred out of a handler. */
export class ManualScheduler implements Scheduler {
  private nextId = 1;
  private readonly tasks = new Map<number, () => void>();

  get pending(): number {
    return this.tasks.size;
  }
  setTimeout(fn: () => void): TimeoutHandle {
    const id = this.nextId++;
    this.tasks.set(id, fn);
    return { id };
  }
  clearTimeout(handle: TimeoutHandle): void {
    if (typeof handle.id === 'number') this.tasks.delete(handle.id);
  }
  setInterval(fn: () => void): TimeoutHandle {
    return this.setTimeout(fn);
  }
  clearInterval(handle: TimeoutHandle): void {
    this.clearTimeout(handle);
  }
  runAll(): void {
    const due = [...this.tasks.values()];
    this.tasks.clear();
    for (const fn of due) fn();
  }
}

export class SeededRng implements Rng {
  private state: number;
  constructor(seed: number) {
    this.state = seed;
  }
  next(): number {
    this.state = (this.state * 1664525 + 1013904223) % 4294967296;
    return this.state / 4294967296;
  }
}
