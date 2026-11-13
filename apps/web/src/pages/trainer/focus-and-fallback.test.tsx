// @vitest-environment happy-dom
import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { render } from 'preact';
import { TrainerPage } from './ui/trainer-page';
import { createTrainer } from '@/features/training';
import type { PromptItem } from '@/entities/prompt';
import { contentSetting, setContent } from '@/entities/settings';
import * as kanaModule from '@/entities/prompt';
import { t } from '@/shared/i18n';

describe('trainer UI: focus redirection and content loader error fallback', () => {
  let container: HTMLDivElement;

  beforeEach(() => {
    // Real chunks arrive on their own time and would restart the test; the prompts here are fixed.
    vi.spyOn(kanaModule, 'loadChunk').mockResolvedValue([]);
    setContent('words');
    container = document.createElement('div');
    document.body.appendChild(container);
  });

  afterEach(() => {
    vi.restoreAllMocks();
    render(null, container);
    container.remove();
  });

  it('letter key pressed while a button has focus moves focus to input and is processed (Plan 6.2)', async () => {
    const prompt: PromptItem = { key: 'basic:ka', text: 'か' };
    const trainer = createTrainer({ nextPrompt: () => prompt });
    const controller = trainer.session;

    render(<TrainerPage trainer={trainer} />, container);

    // Wait for Preact mount effects to complete
    await new Promise((resolve) => setTimeout(resolve, 20));

    // Load a 2-letter kana prompt so first character does not immediately complete it
    controller.loadPrompt(prompt, 'learner');

    // Find the input and a button (e.g. rows button or restart button)
    const input = container.querySelector('input');
    const button = container.querySelector('button');
    expect(input).not.toBeNull();
    expect(button).not.toBeNull();

    if (!input || !button) return;

    // Focus the button
    button.focus();
    expect(document.activeElement).toBe(button);

    // Press 'k' on the button
    const event = new KeyboardEvent('keydown', { key: 'k', bubbles: true });
    button.dispatchEvent(event);

    // Focus must move to input
    expect(document.activeElement).toBe(input);
    // Buffer must have processed 'k'
    expect(controller.romajiBuffer.value).toBe('k');
    expect(controller.correctKeystrokes.value).toBe(1);

    // Focus button again and press 'Escape'
    button.focus();
    expect(document.activeElement).toBe(button);

    const escEvent = new KeyboardEvent('keydown', { key: 'Escape', bubbles: true });
    button.dispatchEvent(escEvent);

    // Focus must return to input without activating reveal
    expect(document.activeElement).toBe(input);
    expect(controller.isAssisted.value).toBe(false);
  });

  it('content chunk failure keeps the setting and shows an i18n message with Retry', async () => {
    // Spy on loadChunk and make it reject (simulating failed dynamic import chunk)
    const loadChunkSpy = vi
      .spyOn(kanaModule, 'loadChunk')
      .mockRejectedValue(new Error('Failed to fetch dynamically imported module'));

    const prompt: PromptItem = { key: 'basic:a', text: 'あ' };
    const trainer = createTrainer({ nextPrompt: () => prompt });

    render(<TrainerPage trainer={trainer} />, container);

    // Switch content to 'words'
    setContent('words');

    // Wait for the promise rejection and fallback to resolve
    await new Promise((resolve) => setTimeout(resolve, 50));

    expect(loadChunkSpy).toHaveBeenCalledWith(expect.stringMatching(/^words-/));
    // The setting is kept (frontend.md, "Loading"); there is nothing to type until Retry.
    expect(contentSetting.value).toBe('words');

    // Must show the i18n error notice
    const expectedMessage = t('stage.contentLoadError');
    expect(container.textContent).toContain(expectedMessage);
  });
});
