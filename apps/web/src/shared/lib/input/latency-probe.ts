// A probe of the keystroke latency, for the Playwright latency test (docs/spec/quality.md, "Latency
// measurement"). It exists in the test build only: `__LATENCY_PROBE__` is a constant of the build,
// so in the production build the branch below is dead code and is removed, which `check-budget.mjs`
// verifies. The Event Timing API is not used: it reports only events longer than 16 ms and rounds
// them to 8 ms.

/** The two values recorded for a keystroke, in milliseconds. */
export type KeystrokeSample = {
  // From the entry of the key handler to the end of the work the key caused: the state updates, the
  // render of whatever they made render, and a forced style and layout read. It does not include
  // waiting for a frame.
  work: number;
  // From the same entry to a task posted from the next animation frame: the work, the frame it
  // waits for (0 to one frame) and the frame's own style, layout and paint.
  frame: number;
};

export type ProbeDeps = {
  readonly now: () => number;
  readonly requestFrame: (callback: () => void) => void;
  readonly afterMicrotasks: (callback: () => void) => void;
  // A task: what a MessageChannel delivers, after the work of the frame it was posted in.
  readonly postTask: (callback: () => void) => void;
  // Forces the style and layout that the keystroke made stale (a read of the romaji buffer's box).
  readonly forceLayout: () => void;
};

export type KeystrokeProbe = {
  /** Called at the entry of a key handler; the function it returns is called when the handler is done. */
  readonly start: () => () => void;
  readonly samples: readonly KeystrokeSample[];
  readonly reset: () => void;
};

export function createKeystrokeProbe(deps: ProbeDeps): KeystrokeProbe {
  const samples: KeystrokeSample[] = [];

  return {
    start() {
      const entry = deps.now();
      const sample: KeystrokeSample = { work: Number.NaN, frame: Number.NaN };

      // The frame is requested at the entry, so it is the next one.
      deps.requestFrame(() => {
        deps.postTask(() => {
          sample.frame = deps.now() - entry;
          samples.push(sample);
        });
      });

      return () => {
        // After the microtasks the handler queued: that is where the components render.
        deps.afterMicrotasks(() => {
          deps.forceLayout();
          sample.work = deps.now() - entry;
        });
      };
    },
    samples,
    reset() {
      samples.length = 0;
    },
  };
}

function installInPage(): KeystrokeProbe {
  const probe = createKeystrokeProbe({
    now: () => performance.now(),
    requestFrame: (callback) => {
      requestAnimationFrame(callback);
    },
    afterMicrotasks: (callback) => {
      queueMicrotask(callback);
    },
    postTask: (callback) => {
      const channel = new MessageChannel();
      channel.port1.onmessage = () => {
        channel.port1.close();
        callback();
      };
      channel.port2.postMessage(null);
    },
    forceLayout: () => {
      document
        .querySelector('[data-testid="prompt-arena"] .nk-test__buffer')
        ?.getBoundingClientRect();
    },
  });
  // The latency test reads the samples from here.
  Object.assign(window, { __nekotypeProbe: probe });
  return probe;
}

const probe = __LATENCY_PROBE__ ? installInPage() : null;

/** Starts measuring a keystroke; null (and free) outside the test build. */
export function startKeystrokeProbe(): (() => void) | null {
  return probe === null ? null : probe.start();
}
