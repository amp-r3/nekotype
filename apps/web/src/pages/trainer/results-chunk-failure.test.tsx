// @vitest-environment happy-dom
import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { render } from 'preact';
import { createTrainer } from '@/features/training';
import type { Trainer } from '@/features/training';
import * as promptModule from '@/entities/prompt';
import type { PromptItem } from '@/entities/prompt';
import { setTestConfig } from '@/entities/settings';
import { TrainerPage } from './ui/trainer-page';
import { loadDictionaryPart } from '@/shared/i18n';

// The route brings the strings of the screen; here the test does.
await loadDictionaryPart('type');

// The results chunk cannot be fetched.
vi.mock('./ui/results-panel', () => {
  throw new Error('offline');
});

const settle = (): Promise<void> => new Promise((resolve) => setTimeout(resolve, 30));
const neko: PromptItem = { key: 'word:neko', text: 'ねこ' };

describe('results screen: the chunk fails to load', () => {
  let container: HTMLDivElement;
  let trainer: Trainer;

  beforeEach(async () => {
    // Real chunks arrive on their own time and would restart the test; the prompts here are fixed.
    vi.spyOn(promptModule, 'loadChunk').mockResolvedValue([]);
    setTestConfig({ kind: 'zen' });
    container = document.createElement('div');
    document.body.appendChild(container);
    trainer = createTrainer({ nextPrompt: () => neko });
    render(<TrainerPage trainer={trainer} />, container);
    await settle();
    const field = container.querySelector('input');
    for (const k of 'neko') {
      field?.dispatchEvent(
        new KeyboardEvent('keydown', { key: k, bubbles: true, cancelable: true }),
      );
    }
    await settle();
    trainer.session.finish();
    await settle();
  });

  afterEach(() => {
    vi.restoreAllMocks();
    render(null, container);
    container.remove();
    document.documentElement.removeAttribute('data-testing');
    setTestConfig({ kind: 'time', seconds: 30 });
  });

  it('shows the error with Retry, and Next test and Enter still start a test', async () => {
    expect(container.querySelector('[role="alert"]')).not.toBeNull();
    const labels = Array.from(container.querySelectorAll('button')).map((b) => b.textContent);
    expect(labels).toContain('retry');
    expect(labels.some((label) => label.startsWith('next test'))).toBe(true);

    document.dispatchEvent(new KeyboardEvent('keydown', { key: 'Enter', bubbles: true }));
    await settle();
    expect(trainer.session.phase.value).toBe('idle');
  });
});
