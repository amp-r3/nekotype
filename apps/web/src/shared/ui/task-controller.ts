// The DOM writer of one task of a learning session (docs/spec/frontend.md, "Hot path"; design
// system KanaTask). It changes classes, text and transforms only. Positions are measured when the
// layout can have changed: on creation, on a resize of the stage and when the fonts are in; never
// on a keystroke.
//
// The elements, as `KanaTask` renders them (found by `data-task-*` attributes):
//   root     `data-kind`; gets `is-blurred`, `is-input-blurred`, `is-done` and, while the caret is put
//            in place after a measurement, `is-snap`
//   stage    observed for size changes
//   kana     the kana (introduction, recall); `is-correct` / `is-miss` after the answer
//   caret    absolute; its child `data-task-flash` is shown for a rejected key
//   buffer   recall: the romaji typed beyond the caret
//   letters  introduction: one element per letter of the ghost hint

export type TaskKind = 'introduction' | 'recall' | 'recognition';

export type TaskController = {
  readonly kind: TaskKind;
  /** Recall: the romaji typed so far, under the kana. */
  readonly setBuffer: (text: string) => void;
  /** Introduction: the number of letters of the hint typed. */
  readonly type: (count: number) => void;
  /** A key was rejected: the caret flashes. */
  readonly reject: () => void;
  /** The answer is complete. */
  readonly finish: (result: 'correct' | 'miss') => void;
  /** The task starts over (the tab was hidden). */
  readonly reset: () => void;
  readonly setWindowFocus: (on: boolean) => void;
  readonly setInputFocus: (on: boolean) => void;
  /** The layout may have changed: measure again. */
  readonly measure: () => void;
  readonly destroy: () => void;
};

const DEFAULT_REJECT_MS = 120;

function kindOf(root: HTMLElement): TaskKind {
  const kind = root.getAttribute('data-kind');
  return kind === 'introduction' || kind === 'recognition' ? kind : 'recall';
}

function cssMilliseconds(element: Element, name: string): number {
  const raw = getComputedStyle(element).getPropertyValue(name).trim();
  const value = Number.parseFloat(raw);
  if (Number.isNaN(value)) return DEFAULT_REJECT_MS;
  return raw.endsWith('ms') ? value : raw.endsWith('s') ? value * 1000 : DEFAULT_REJECT_MS;
}

function reducedMotionQuery(): () => boolean {
  try {
    const query = window.matchMedia('(prefers-reduced-motion: reduce)');
    return () => query.matches;
  } catch {
    return () => false;
  }
}

export function createTaskController(root: HTMLElement): TaskController {
  const kind = kindOf(root);
  const stage = root.querySelector<HTMLElement>('[data-task-stage]');
  const kana = root.querySelector<HTMLElement>('[data-task-kana]');
  const caret = root.querySelector<HTMLElement>('[data-task-caret]');
  const flash = root.querySelector<HTMLElement>('[data-task-flash]');
  const buffer = root.querySelector<HTMLElement>('[data-task-buffer]');
  const letters = Array.from(root.querySelectorAll<HTMLElement>('[data-task-letter]'));
  const reducedMotion = reducedMotionQuery();

  // Caret positions: before each letter of the hint, then after the last one.
  let stops: number[] = [];
  let kanaWidth = 0;
  let typed = 0;
  let done = false;
  let frame = 0;

  function place(): void {
    if (caret === null) return;
    const x = kind === 'introduction' ? (stops[typed] ?? 0) : done ? kanaWidth : 0;
    caret.style.transform = `translate3d(${String(x - 1)}px,0,0)`;
  }

  function measure(): void {
    root.classList.add('is-snap');
    if (letters.length > 0) {
      stops = letters.map((letter) => letter.offsetLeft);
      const last = letters[letters.length - 1];
      if (last !== undefined) stops.push(last.offsetLeft + last.offsetWidth);
    }
    if (kana !== null) kanaWidth = kana.offsetWidth;
    place();
    // The caret jumps to its place; the next keystroke glides again.
    if (typeof requestAnimationFrame === 'function') {
      cancelAnimationFrame(frame);
      frame = requestAnimationFrame(() => {
        frame = requestAnimationFrame(() => {
          root.classList.remove('is-snap');
        });
      });
    } else {
      root.classList.remove('is-snap');
    }
  }

  let observer: ResizeObserver | undefined;
  if (stage !== null && typeof ResizeObserver === 'function') {
    observer = new ResizeObserver(measure);
    observer.observe(stage);
  }
  let alive = true;
  if (typeof document !== 'undefined' && 'fonts' in document) {
    void document.fonts.ready.then(() => {
      if (alive) measure();
    });
  }
  measure();

  return {
    kind,
    setBuffer(text) {
      if (buffer !== null && buffer.textContent !== text) buffer.textContent = text;
    },
    type(count) {
      typed = count;
      letters.forEach((letter, i) => {
        letter.classList.toggle('is-typed', i < count);
      });
      place();
    },
    reject() {
      if (flash === null || typeof flash.animate !== 'function') return;
      for (const animation of flash.getAnimations()) animation.cancel();
      flash.animate([{ opacity: 1 }, { opacity: 0 }], {
        duration: cssMilliseconds(root, '--dur-reject'),
        easing: reducedMotion() ? 'step-end' : 'cubic-bezier(0.4, 0, 1, 1)',
      });
    },
    finish(result) {
      done = true;
      if (buffer !== null) buffer.textContent = '';
      if (kana !== null) {
        kana.classList.toggle('is-correct', result === 'correct');
        kana.classList.toggle('is-miss', result === 'miss');
      }
      if (kind === 'introduction') typed = letters.length;
      letters.forEach((letter) => {
        letter.classList.add('is-typed');
      });
      root.classList.add('is-done');
      place();
    },
    reset() {
      done = false;
      typed = 0;
      if (buffer !== null) buffer.textContent = '';
      if (kana !== null) kana.classList.remove('is-correct', 'is-miss');
      letters.forEach((letter) => {
        letter.classList.remove('is-typed');
      });
      root.classList.remove('is-done');
      place();
    },
    setWindowFocus(on) {
      root.classList.toggle('is-blurred', !on);
    },
    setInputFocus(on) {
      root.classList.toggle('is-input-blurred', !on);
    },
    measure,
    destroy() {
      alive = false;
      observer?.disconnect();
      if (typeof cancelAnimationFrame === 'function') cancelAnimationFrame(frame);
    },
  };
}
