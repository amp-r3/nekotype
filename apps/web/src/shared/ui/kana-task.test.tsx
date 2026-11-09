// @vitest-environment happy-dom
import { describe, it, expect, afterEach, vi } from 'vitest';
import { render, options } from 'preact';
import { KanaTask } from './kana-task';
import type { KanaTaskProps, TaskLabels } from './kana-task';
import { OptionCard } from './option-card';
import type { TaskController } from './task-controller';

const labels: TaskLabels = {
  learning: 'learning',
  review: 'review',
  of: 'of',
  newKana: 'new kana',
  show: 'show the romaji',
  blur: 'return to the window',
  focus: 'click to focus',
  leave: 'leave session',
  esc: 'esc',
  options: 'options',
};

let container: HTMLDivElement;

function mount(props: Partial<KanaTaskProps> & Pick<KanaTaskProps, 'kind'>): HTMLDivElement {
  container = document.createElement('div');
  document.body.append(container);
  render(
    <KanaTask session={{ kind: 'learning', n: 7, total: 25 }} labels={labels} {...props} />,
    container,
  );
  return container;
}

afterEach(() => {
  render(null, container);
  container.remove();
});

function task(): HTMLElement {
  const root = container.querySelector<HTMLElement>('[data-testid="kana-task"]');
  if (root === null) throw new Error('no task');
  return root;
}

type ViewportWindow = {
  happyDOM: { setViewport: (size: { width: number; height: number }) => void };
};

function hasViewport(w: unknown): w is ViewportWindow {
  return typeof w === 'object' && w !== null && 'happyDOM' in w;
}

function resize(width: number): void {
  if (!hasViewport(window)) throw new Error('no happyDOM');
  window.happyDOM.setViewport({ width, height: 768 });
}

describe('KanaTask', () => {
  it('does not rebuild the controller when the window width changes', async () => {
    resize(1024);
    const onReady = vi.fn<(controller: TaskController) => void>();
    mount({ kind: 'recall', kana: 'ぬ', onReady });
    resize(500);
    await new Promise((resolve) => setTimeout(resolve, 20));
    expect(onReady).toHaveBeenCalledTimes(1);
  });

  it('sizes the kana by the width through CSS classes', () => {
    mount({ kind: 'recall', kana: 'ぬ' });
    const kana = container.querySelector('[data-task-kana]');
    expect(kana?.classList.contains('max-sm:text-jp-solo-sm')).toBe(true);
    expect(container.querySelector('.is-narrow, .is-wide')).toBeNull();
  });

  it('shows the session line from the props', () => {
    mount({ kind: 'recall', kana: 'ぬ' });
    expect(container.querySelector('[data-testid="task-session"]')?.textContent).toBe(
      'learning · 7 of 25',
    );
  });

  it('shows the Esc hint on a pointer and "show the romaji" as a button on a touch screen', () => {
    mount({ kind: 'recall', kana: 'ぬ', coarse: false });
    expect(container.querySelector('kbd')?.textContent).toBe('esc');
    expect(container.querySelector('button')).toBeNull();
    render(null, container);

    const onShow = vi.fn();
    render(
      <KanaTask
        kind="recall"
        kana="ぬ"
        coarse
        session={{ kind: 'review', n: 3, total: 5 }}
        labels={labels}
        onShow={onShow}
      />,
      container,
    );
    const button = container.querySelector('button');
    expect(button?.textContent).toBe('show the romaji');
    button?.click();
    expect(onShow).toHaveBeenCalledTimes(1);
  });

  it('shows the romaji and the options in a recognition task, and no hint', () => {
    mount({
      kind: 'recognition',
      romaji: 'nu',
      children: [1, 2, 3, 4].map((n) => (
        <OptionCard key={n} n={n} kana ariaLabel={`${String(n)}: ぬ`}>
          ぬ
        </OptionCard>
      )),
    });
    expect(container.querySelector('[data-testid="task-prompt"]')?.textContent).toBe('nu');
    const group = container.querySelector('[role="group"]');
    expect(group?.getAttribute('aria-label')).toBe('options');
    expect(group?.querySelectorAll('button')).toHaveLength(4);
    expect(container.querySelector('.nk-task__hint')).toBeNull();
  });

  it('offers "leave session" only with a handler', () => {
    mount({ kind: 'introduction', kana: 'ぬ', romaji: 'nu' });
    expect(container.textContent).not.toContain('leave session');
    const onLeave = vi.fn();
    render(
      <KanaTask
        kind="introduction"
        kana="ぬ"
        romaji="nu"
        session={{ kind: 'learning', n: 1, total: 25 }}
        labels={labels}
        onLeave={onLeave}
      />,
      container,
    );
    container.querySelector('button')?.click();
    expect(onLeave).toHaveBeenCalledTimes(1);
  });

  it('renders once per task and hands over the controller once', () => {
    const onReady = vi.fn<(controller: TaskController) => void>();
    let renders = 0;
    const previous = options.diffed?.bind(options) ?? ((): void => {});
    options.diffed = (vnode) => {
      if (vnode.type === KanaTask) renders += 1;
      previous(vnode);
    };
    try {
      mount({ kind: 'recall', kana: 'ぬ', onReady });
      expect(renders).toBe(1);
      expect(onReady).toHaveBeenCalledTimes(1);
      const controller = onReady.mock.calls[0]?.[0];
      controller?.setBuffer('n');
      controller?.reject();
      controller?.finish('correct');
      expect(renders).toBe(1);
    } finally {
      options.diffed = previous;
    }
  });
});

describe('createTaskController', () => {
  function ready(props: Partial<KanaTaskProps> & Pick<KanaTaskProps, 'kind'>): TaskController {
    const onReady = vi.fn<(controller: TaskController) => void>();
    mount({ ...props, onReady });
    const controller = onReady.mock.calls[0]?.[0];
    if (controller === undefined) throw new Error('no controller');
    return controller;
  }

  it('writes the buffer and clears it on finish and reset', () => {
    const controller = ready({ kind: 'recall', kana: 'ぬ' });
    const buffer = container.querySelector('[data-task-buffer]');
    controller.setBuffer('n');
    expect(buffer?.textContent).toBe('n');
    controller.finish('miss');
    expect(buffer?.textContent).toBe('');
    const kana = container.querySelector('[data-task-kana]');
    expect(kana?.classList.contains('is-miss')).toBe(true);
    expect(task().classList.contains('is-done')).toBe(true);
    controller.reset();
    expect(kana?.classList.contains('is-miss')).toBe(false);
    expect(task().classList.contains('is-done')).toBe(false);
  });

  it('turns typed letters of the hint', () => {
    const controller = ready({ kind: 'introduction', kana: 'きゃ', romaji: 'kya' });
    const typed = (): number => container.querySelectorAll('.nk-task__letter.is-typed').length;
    controller.type(2);
    expect(typed()).toBe(2);
    controller.type(0);
    expect(typed()).toBe(0);
    controller.finish('correct');
    expect(typed()).toBe(3);
  });

  it('marks the lost window and input focus', () => {
    const controller = ready({ kind: 'recall', kana: 'ぬ' });
    controller.setWindowFocus(false);
    controller.setInputFocus(false);
    expect(task().classList.contains('is-blurred')).toBe(true);
    expect(task().classList.contains('is-input-blurred')).toBe(true);
    controller.setWindowFocus(true);
    controller.setInputFocus(true);
    expect(task().classList.contains('is-blurred')).toBe(false);
    expect(task().classList.contains('is-input-blurred')).toBe(false);
  });

  it('flashes the caret for the length of --dur-reject', () => {
    const controller = ready({ kind: 'recall', kana: 'ぬ' });
    const flash = container.querySelector<HTMLElement>('[data-task-flash]');
    if (flash === null) throw new Error('no flash');
    const animate = vi.fn();
    Object.assign(flash, { animate, getAnimations: () => [] });
    task().style.setProperty('--dur-reject', '120ms');
    controller.reject();
    expect(animate).toHaveBeenCalledTimes(1);
    expect(animate.mock.calls[0]?.[1]).toMatchObject({ duration: 120 });
  });
});

describe('OptionCard', () => {
  it('shows its key and kana, and reports a click', () => {
    const onClick = vi.fn();
    mount({ kind: 'recall' });
    render(
      <OptionCard n={2} kana ariaLabel="2: ぬ" onClick={onClick}>
        ぬ
      </OptionCard>,
      container,
    );
    const button = container.querySelector('button');
    expect(button?.getAttribute('aria-label')).toBe('2: ぬ');
    expect(button?.querySelector('kbd')?.textContent).toBe('2');
    button?.click();
    expect(onClick).toHaveBeenCalledTimes(1);
  });

  it('names the answer states in its markup', () => {
    mount({ kind: 'recall' });
    render(
      <>
        <OptionCard n={1} state="correct">
          a
        </OptionCard>
        <OptionCard n={2} state="wrong">
          b
        </OptionCard>
        <OptionCard n={3} state="idle" disabled>
          c
        </OptionCard>
      </>,
      container,
    );
    const [correct, wrong, idle] = Array.from(container.querySelectorAll('button'));
    expect(correct?.classList.contains('is-correct')).toBe(true);
    expect(wrong?.classList.contains('is-wrong')).toBe(true);
    // The result is the accessible name's job (ariaLabel), not a toggle state.
    for (const button of [correct, wrong, idle])
      expect(button?.hasAttribute('aria-pressed')).toBe(false);
    expect(idle?.disabled).toBe(true);
  });
});
