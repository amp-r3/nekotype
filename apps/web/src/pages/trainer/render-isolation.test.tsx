// @vitest-environment happy-dom
import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { render, options, Fragment } from 'preact';
import type { VNode } from 'preact';
import { TrainerPage } from './ui/trainer-page';
import { createTrainer } from '@/features/training';
import type { Trainer } from '@/features/training';
import * as promptModule from '@/entities/prompt';
import type { PromptItem } from '@/entities/prompt';
import { setTestConfig } from '@/entities/settings';
import { MIN_AHEAD_TOKENS } from '@/features/training';
import { loadResultsPanel } from './results-loader';
import { loadDictionaryPart } from '@/shared/i18n';

// The route brings the strings of the screen; here the test does.
await loadDictionaryPart('type');

const tick = (): Promise<void> => new Promise((resolve) => setTimeout(resolve, 0));
const settle = (): Promise<void> => new Promise((resolve) => setTimeout(resolve, 30));

// Spec "Hot path" (D16): a keystroke that does not complete a prompt renders no component, and one
// that completes a prompt renders at most one, the stream. Every component render of the page is
// counted, from the very first key (which starts the test) on. The stream is redrawn only when its
// window is about to run out (stream.ts), so most completing keys render nothing at all.
describe('render isolation: the hot path renders nothing', () => {
  const neko: PromptItem = { key: 'word:neko', text: 'ねこ' };

  let container: HTMLDivElement;
  let trainer: Trainer;
  let input: HTMLInputElement;
  let prevDiffed: ((vnode: VNode) => void) | undefined;

  beforeEach(async () => {
    // The results screen is a lazy chunk; the checks below count its render like any other.
    await loadResultsPanel();
    // The real chunks load on their own time and would render the page mid-test; the prompts here
    // are fixed anyway.
    vi.spyOn(promptModule, 'loadChunk').mockResolvedValue([]);
    setTestConfig({ kind: 'time', seconds: 120 });
    container = document.createElement('div');
    document.body.appendChild(container);
    trainer = createTrainer({ nextPrompt: () => neko });
    render(<TrainerPage trainer={trainer} />, container);
    await settle();
    const found = container.querySelector('input');
    if (found === null) throw new Error('no input field');
    input = found;
    prevDiffed = options.diffed?.bind(options);
  });

  afterEach(() => {
    vi.restoreAllMocks();
    if (prevDiffed) {
      options.diffed = prevDiffed;
    } else {
      delete options.diffed;
    }
    render(null, container);
    container.remove();
    document.documentElement.removeAttribute('data-testing');
  });

  /** Presses a key in the field and returns the components that rendered because of it. */
  async function press(key: string): Promise<string[]> {
    const rendered: string[] = [];
    options.diffed = (vnode: VNode) => {
      // A Fragment wraps a list of children; it is Preact's, not a component of ours.
      if (typeof vnode.type === 'function' && vnode.type !== Fragment) {
        rendered.push(vnode.type.name);
      }
      if (prevDiffed) prevDiffed(vnode);
    };
    input.dispatchEvent(new KeyboardEvent('keydown', { key, bubbles: true, cancelable: true }));
    // Preact renders on a microtask; give it its turn before looking.
    await tick();
    if (prevDiffed) {
      options.diffed = prevDiffed;
    } else {
      delete options.diffed;
    }
    return rendered;
  }

  it('the first key, which starts the test, renders nothing', async () => {
    expect(trainer.session.phase.value).toBe('idle');
    expect(await press('n')).toEqual([]);
    expect(trainer.session.phase.value).toBe('running');
  });

  it('a key inside a prompt renders nothing, and the key that completes it renders at most the stream', async () => {
    expect(await press('n')).toEqual([]);
    expect(await press('e')).toEqual([]);
    expect(await press('k')).toEqual([]);
    expect(trainer.session.promptResults.value).toHaveLength(0);
    // こ completes ねこ: the next prompt is on display. The window drawn is far from running out.
    expect(await press('o')).toEqual([]);
    expect(trainer.session.promptResults.value).toHaveLength(1);
    expect(container.querySelector('[data-testid="prompt-text"]')?.textContent).toBe('ねこ');
  });

  it('a rejected key, a hint, a wrong layout and its end render nothing', async () => {
    await press('n');
    expect(await press('x')).toEqual([]);
    expect(await press('x')).toEqual([]);
    expect(await press('Escape')).toEqual([]);
    // Cyrillic: the notice line gets text, nothing renders; the next Latin key takes it away.
    expect(await press('ф')).toEqual([]);
    expect(container.textContent).toContain('Switch your keyboard layout to English');
    expect(await press('e')).toEqual([]);
    expect(container.textContent).not.toContain('Switch your keyboard layout to English');
  });

  it('shows the hint through a text node, in the line kept for it', async () => {
    expect(container.textContent).not.toContain('Revealed');
    expect(await press('Escape')).toEqual([]);
    expect(container.textContent).toContain('Revealed: neko');
  });

  it('keeps the rule over 45 prompts, through every compact() of the matcher', async () => {
    const rendered: string[][] = [];
    for (let prompt = 0; prompt < 45; prompt++) {
      for (const key of 'neko') rendered.push(await press(key));
    }
    expect(trainer.session.promptResults.value).toHaveLength(45);

    rendered.forEach((components, i) => {
      // The fourth key of each prompt completes it: at most the stream renders, no other key does.
      const completes = i % 4 === 3;
      expect(components.length, `key ${i}`).toBeLessThanOrEqual(completes ? 1 : 0);
      expect(
        components.every((name) => name === 'TextStream'),
        `key ${i}`,
      ).toBe(true);
    });

    // The stream is redrawn a few times, not at every prompt (2 tokens per prompt, a new window
    // when fewer than MIN_AHEAD_TOKENS remain)...
    const redraws = rendered.filter((components) => components.length > 0).length;
    expect(redraws).toBeGreaterThanOrEqual(2);
    expect(redraws).toBeLessThanOrEqual(6);

    // ...and what is drawn always has the text ahead of the caret that a wide screen shows.
    const numbers = Array.from(container.querySelectorAll('[data-token]')).map((el) =>
      Number(el.getAttribute('data-token')),
    );
    expect(Math.max(...numbers) - trainer.session.caret.value).toBeGreaterThanOrEqual(
      MIN_AHEAD_TOKENS - 1,
    );
    expect(numbers).toContain(trainer.session.caret.value);
  });

  it('writes the stream to the DOM instead: classes, and the attributes tests read', async () => {
    const arena = container.querySelector('[data-testid="prompt-arena"]');
    expect(arena?.getAttribute('data-phase')).toBe('idle');
    // The answer is not in the DOM: tests work it out from the prompt's text.
    expect(arena?.hasAttribute('data-canonical')).toBe(false);
    expect(arena?.getAttribute('data-rejected')).toBeNull();

    await press('n');
    await press('e');
    expect(arena?.getAttribute('data-phase')).toBe('running');
    // ね is typed: the first token has the typed class.
    expect(arena?.querySelector('[data-token="0"]')?.className).toBe('nk-char is-correct');
    expect(arena?.querySelector('[data-token="1"]')?.className).toBe('nk-char is-untyped');

    await press('x');
    expect(arena?.getAttribute('data-rejected')).toBe('true');
    expect(arena?.querySelector('[data-token="1"]')?.className).toBe('nk-char is-miss');
    await press('k');
    expect(arena?.getAttribute('data-rejected')).toBeNull();
  });

  it('hides the interface by one attribute on the document, not by rendering', async () => {
    expect(document.documentElement.hasAttribute('data-testing')).toBe(false);
    expect(await press('n')).toEqual([]);
    expect(document.documentElement.hasAttribute('data-testing')).toBe(true);

    trainer.restart();
    await settle();
    expect(document.documentElement.hasAttribute('data-testing')).toBe(false);
  });

  it('a mouse movement beyond a few pixels shows the interface until the next key', async () => {
    await press('n');
    const move = (x: number, y: number): void => {
      window.dispatchEvent(new MouseEvent('mousemove', { clientX: x, clientY: y }));
    };
    move(100, 100);
    move(104, 100);
    expect(document.documentElement.hasAttribute('data-testing')).toBe(true);
    move(120, 100);
    expect(document.documentElement.hasAttribute('data-testing')).toBe(false);

    await press('e');
    expect(document.documentElement.hasAttribute('data-testing')).toBe(true);
  });
});

describe('render isolation: a zen test', () => {
  const neko: PromptItem = { key: 'word:neko', text: 'ねこ' };

  let container: HTMLDivElement;
  let trainer: Trainer;
  let input: HTMLInputElement;
  let prevDiffed: ((vnode: VNode) => void) | undefined;

  beforeEach(async () => {
    setTestConfig({ kind: 'zen' });
    container = document.createElement('div');
    document.body.appendChild(container);
    trainer = createTrainer({ nextPrompt: () => neko });
    render(<TrainerPage trainer={trainer} />, container);
    await settle();
    const found = container.querySelector('input');
    if (found === null) throw new Error('no input field');
    input = found;
    prevDiffed = options.diffed?.bind(options);
  });

  afterEach(() => {
    if (prevDiffed) {
      options.diffed = prevDiffed;
    } else {
      delete options.diffed;
    }
    render(null, container);
    container.remove();
    document.documentElement.removeAttribute('data-testing');
    setTestConfig({ kind: 'time', seconds: 30 });
  });

  const finishButton = (): HTMLButtonElement | undefined =>
    Array.from(container.querySelectorAll('button')).find((b) => b.textContent.includes('Finish'));

  async function press(key: string): Promise<string[]> {
    const rendered: string[] = [];
    options.diffed = (vnode: VNode) => {
      if (typeof vnode.type === 'function' && vnode.type !== Fragment) {
        rendered.push(vnode.type.name);
      }
      if (prevDiffed) prevDiffed(vnode);
    };
    input.dispatchEvent(new KeyboardEvent('keydown', { key, bubbles: true, cancelable: true }));
    await tick();
    if (prevDiffed) {
      options.diffed = prevDiffed;
    } else {
      delete options.diffed;
    }
    return rendered;
  }

  it('shows a Finish button with its shortcut, disabled until the test starts, and a counter of prompts', () => {
    const button = finishButton();
    expect(button?.disabled).toBe(true);
    expect(button?.textContent).toContain('ctrl + enter');
    expect(container.querySelector('[data-testid="live-counter"]')?.textContent).toBe('0');
  });

  it('the first key enables Finish without rendering anything, and the rule still holds', async () => {
    expect(await press('n')).toEqual([]);
    expect(finishButton()?.disabled).toBe(false);
    expect(await press('e')).toEqual([]);
    expect(await press('k')).toEqual([]);
    expect(await press('o')).toEqual([]);
    // The counter follows the completed prompts, as a text node.
    expect(container.querySelector('[data-testid="live-counter"]')?.textContent).toBe('1');
  });

  it('Ctrl+Enter ends the test and the page shows the results', async () => {
    await press('n');
    await press('e');
    await press('k');
    await press('o');
    input.dispatchEvent(
      new KeyboardEvent('keydown', {
        key: 'Enter',
        ctrlKey: true,
        bubbles: true,
        cancelable: true,
      }),
    );
    await settle();
    expect(trainer.session.phase.value).toBe('finished');
    expect(container.querySelector('[data-testid="results-panel"]')).not.toBeNull();
  });

  it('the Finish button ends the test too', async () => {
    await press('n');
    await press('e');
    await press('k');
    await press('o');
    finishButton()?.click();
    await settle();
    expect(trainer.session.phase.value).toBe('finished');
    expect(container.querySelector('[data-testid="results-panel"]')).not.toBeNull();
  });
});
