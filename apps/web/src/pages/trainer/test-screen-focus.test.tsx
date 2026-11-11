// @vitest-environment happy-dom
import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { render } from 'preact';
import { TrainerPage } from './ui/trainer-page';
import { createTrainer } from '@/features/training';
import type { Trainer } from '@/features/training';
import * as promptModule from '@/entities/prompt';
import type { PromptItem } from '@/entities/prompt';
import { setTestConfig } from '@/entities/settings';
import { t } from '@/shared/i18n';

const settle = (): Promise<void> => new Promise((resolve) => setTimeout(resolve, 30));

const neko: PromptItem = { key: 'word:neko', text: 'ねこ' };

// Spec "Test screen" and "Keyboard" (frontend.md): the field keeps the keyboard when Restart, Finish
// and Next test are used, a dialog ends the test behind it, Tab leaves the interface shown, and
// Enter on the results screen works wherever the focus is not on a control.
describe('test screen: focus, hidden interface and keys', () => {
  let container: HTMLDivElement;
  let trainer: Trainer;

  beforeEach(async () => {
    // Real chunks arrive on their own time and would restart the test; the prompts here are fixed.
    vi.spyOn(promptModule, 'loadChunk').mockResolvedValue([]);
    setTestConfig({ kind: 'count', prompts: 10 });
    container = document.createElement('div');
    document.body.appendChild(container);
    trainer = createTrainer({ nextPrompt: () => neko });
    render(<TrainerPage trainer={trainer} />, container);
    await settle();
  });

  afterEach(() => {
    vi.restoreAllMocks();
    render(null, container);
    container.remove();
    document.documentElement.removeAttribute('data-testing');
    setTestConfig({ kind: 'time', seconds: 30 });
  });

  const field = (): HTMLInputElement => {
    const input = container.querySelector('input');
    if (!input) throw new Error('no input field');
    return input;
  };
  const buttonByText = (text: string): HTMLButtonElement => {
    const found = Array.from(container.querySelectorAll('button')).find((b) =>
      b.textContent.includes(text),
    );
    if (found === undefined) throw new Error(`no button ${text}`);
    return found;
  };
  const key = (target: EventTarget, k: string, init: KeyboardEventInit = {}): KeyboardEvent => {
    const event = new KeyboardEvent('keydown', {
      key: k,
      bubbles: true,
      cancelable: true,
      ...init,
    });
    target.dispatchEvent(event);
    return event;
  };
  const hidden = (): boolean => document.documentElement.hasAttribute('data-testing');

  async function finishTest(): Promise<void> {
    setTestConfig({ kind: 'zen' });
    await settle();
    for (const k of 'neko') key(field(), k);
    await settle();
    trainer.session.finish();
    await settle();
    expect(trainer.session.phase.value).toBe('finished');
  }

  describe('the field keeps the keyboard (L3)', () => {
    it('Restart gives the focus to the same field within the click', async () => {
      const input = field();
      key(input, 'n');
      buttonByText(t('stage.restart')).focus();
      buttonByText(t('stage.restart')).click();
      // No wait: a phone opens the keyboard only for a focus inside the gesture.
      expect(document.activeElement).toBe(input);
      await settle();
      expect(field()).toBe(input);
    });

    it('Finish of a zen test that is dropped keeps the focus on the field', async () => {
      setTestConfig({ kind: 'zen' });
      await settle();
      const input = field();
      key(input, 'n');
      const finish = buttonByText(t('stage.finish'));
      finish.focus();
      finish.click();
      expect(document.activeElement).toBe(input);
    });

    it('Next test gives the focus to the field within the click', async () => {
      const input = field();
      await finishTest();
      expect(document.activeElement).toBe(buttonByText(t('results.nextTest')));
      buttonByText(t('results.nextTest')).click();
      expect(document.activeElement).toBe(input);
      await settle();
      expect(field()).toBe(input);
      expect(trainer.session.phase.value).toBe('idle');
    });

    it('typing is not taken from the Next test button while the results show', async () => {
      await finishTest();
      const next = buttonByText(t('results.nextTest'));
      key(next, 'a');
      expect(document.activeElement).toBe(next);
    });
  });

  describe('the hidden interface (L6)', () => {
    it('Tab and Shift do not hide it again, any other key does', async () => {
      key(field(), 'n');
      await settle();
      expect(hidden()).toBe(true);
      window.dispatchEvent(new MouseEvent('mousemove', { clientX: 100, clientY: 100 }));
      window.dispatchEvent(new MouseEvent('mousemove', { clientX: 200, clientY: 100 }));
      expect(hidden()).toBe(false);

      key(document.body, 'Shift', { shiftKey: true });
      key(document.body, 'Tab', { shiftKey: true });
      key(document.body, 'Tab');
      expect(hidden()).toBe(false);

      key(field(), 'e');
      expect(hidden()).toBe(true);
    });

    it('a key press resets where the mouse started, so a slow drift over the test shows nothing', async () => {
      key(field(), 'n');
      await settle();
      const move = (x: number): void => {
        window.dispatchEvent(new MouseEvent('mousemove', { clientX: x, clientY: 100 }));
      };
      move(100);
      move(105);
      key(field(), 'e');
      move(110);
      move(115);
      expect(hidden()).toBe(true);
    });
  });

  describe('Enter on the results screen (L9)', () => {
    it('starts the next test when the focus is on nothing', async () => {
      await finishTest();
      if (document.activeElement instanceof HTMLElement) document.activeElement.blur();
      const event = key(document.body, 'Enter');
      expect(event.defaultPrevented).toBe(true);
      expect(trainer.session.phase.value).toBe('idle');
    });

    it('leaves Enter to a control that has the focus, and to modifiers and repeats', async () => {
      await finishTest();
      const nav = document.createElement('a');
      nav.href = '#';
      document.body.appendChild(nav);
      nav.focus();
      expect(key(nav, 'Enter').defaultPrevented).toBe(false);
      nav.remove();

      document.body.focus();
      key(document.body, 'Enter', { ctrlKey: true });
      key(document.body, 'Enter', { repeat: true });
      expect(trainer.session.phase.value).toBe('finished');
    });
  });
});
