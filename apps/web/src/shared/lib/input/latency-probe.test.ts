import { describe, it, expect } from 'vitest';
import { createKeystrokeProbe } from './latency-probe';
import type { ProbeDeps } from './latency-probe';

// A browser in miniature: a clock, and queues that run when the test says a frame, the microtasks or
// a task have come.
function fakeBrowser() {
  let time = 0;
  const frames: (() => void)[] = [];
  const microtasks: (() => void)[] = [];
  const tasks: (() => void)[] = [];
  let layoutReads = 0;

  const deps: ProbeDeps = {
    now: () => time,
    requestFrame: (callback) => {
      frames.push(callback);
    },
    afterMicrotasks: (callback) => {
      microtasks.push(callback);
    },
    postTask: (callback) => {
      tasks.push(callback);
    },
    forceLayout: () => {
      layoutReads += 1;
    },
  };
  const run = (queue: (() => void)[]): void => {
    for (const callback of queue.splice(0)) callback();
  };
  return {
    deps,
    advance: (ms: number) => {
      time += ms;
    },
    runMicrotasks: () => {
      run(microtasks);
    },
    runFrame: () => {
      run(frames);
    },
    runTasks: () => {
      run(tasks);
    },
    layoutReads: () => layoutReads,
  };
}

describe('latency probe: the two values per keystroke', () => {
  it('work is the time to the end of the microtasks and a forced layout; frame is the time to the task after the next frame', () => {
    const browser = fakeBrowser();
    const probe = createKeystrokeProbe(browser.deps);

    browser.advance(100); // the handler is entered at t = 100
    const end = probe.start();
    browser.advance(2); // the handler runs: state updates
    end();
    expect(probe.samples).toHaveLength(0);

    browser.advance(3); // the microtasks: renders
    browser.runMicrotasks();
    expect(browser.layoutReads()).toBe(1);

    browser.advance(12); // waiting for the frame and its style, layout and paint
    browser.runFrame();
    browser.advance(1);
    browser.runTasks();

    expect(probe.samples).toEqual([{ work: 5, frame: 18 }]);
  });

  it('requests the frame at the entry, so a key that works for a long time still waits for the next frame, not a later one', () => {
    const browser = fakeBrowser();
    const probe = createKeystrokeProbe(browser.deps);
    const end = probe.start();
    browser.advance(40); // longer than a frame
    end();
    browser.runMicrotasks();
    browser.runFrame();
    browser.runTasks();

    expect(probe.samples[0]?.work).toBe(40);
    expect(probe.samples[0]?.frame).toBe(40);
  });

  it('keeps a sample for every keystroke, in order, and each has its own times', () => {
    const browser = fakeBrowser();
    const probe = createKeystrokeProbe(browser.deps);

    const first = probe.start();
    browser.advance(1);
    first();
    browser.runMicrotasks();
    browser.advance(5);
    browser.runFrame();
    browser.runTasks();

    const second = probe.start();
    browser.advance(2);
    second();
    browser.runMicrotasks();
    browser.advance(20);
    browser.runFrame();
    browser.runTasks();

    expect(probe.samples).toEqual([
      { work: 1, frame: 6 },
      { work: 2, frame: 22 },
    ]);
  });

  it('reset empties the samples and the probe goes on measuring', () => {
    const browser = fakeBrowser();
    const probe = createKeystrokeProbe(browser.deps);
    const end = probe.start();
    end();
    browser.runMicrotasks();
    browser.runFrame();
    browser.runTasks();
    expect(probe.samples).toHaveLength(1);

    probe.reset();
    expect(probe.samples).toHaveLength(0);
    const again = probe.start();
    again();
    browser.runMicrotasks();
    browser.runFrame();
    browser.runTasks();
    expect(probe.samples).toHaveLength(1);
  });
});
