// @vitest-environment happy-dom
import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { render } from 'preact';
import { TrainerPage } from './ui/trainer-page';
import { createTrainer } from '@/features/training';
import * as promptModule from '@/entities/prompt';
import type { ContentChunk, ContentItem } from '@/entities/prompt';
import { setContent, setScript } from '@/entities/settings';
import { t } from '@/shared/i18n';

const phrase: ContentItem = {
  id: 'p:1',
  text: 'ねこです。',
  script: 'hiragana',
  meaning: { en: 'It is a cat.' },
};

const wait = (): Promise<void> => new Promise((resolve) => setTimeout(resolve, 30));

describe('trainer UI: a script the selected vocabulary has nothing for', () => {
  let container: HTMLDivElement;

  beforeEach(() => {
    // The katakana-only phrase chunk is empty, as in the generated content (ADR 070).
    vi.spyOn(promptModule, 'loadChunk').mockImplementation((chunk: ContentChunk) =>
      Promise.resolve(chunk === 'phrases-katakana' ? [] : [phrase]),
    );
    container = document.createElement('div');
    document.body.appendChild(container);
  });

  afterEach(() => {
    vi.restoreAllMocks();
    render(null, container);
    container.remove();
    setContent('words');
    setScript('both');
  });

  it('says so in the notice slot, ignores keys, and goes away when the script has content', async () => {
    setContent('phrases');
    setScript('katakana');
    const trainer = createTrainer();
    render(<TrainerPage trainer={trainer} />, container);
    await wait();

    const message = t('stage.noContentForScript', { both: t('config.script.both') });
    const slot = container.querySelector('[data-testid="stage-notice"]');
    expect(slot?.textContent).toBe(message);
    expect(slot?.querySelector('[role="status"]')).not.toBeNull();
    expect(trainer.noContentForScript.value).toBe(true);
    expect(trainer.isLoadingContent.value).toBe(false);
    expect(trainer.contentLoadFailed.value).toBe(false);

    trainer.session.handleIntent({ kind: 'char', char: 'a' });
    expect(trainer.session.phase.value).toBe('idle');

    setScript('both');
    await wait();
    expect(trainer.noContentForScript.value).toBe(false);
    expect(slot?.textContent).toBe('');
    expect(trainer.session.currentPrompt.value?.text).toBe('ねこです。');
  });

  it('does not show it while the vocabulary loads, or for a script that has content', async () => {
    let arrive: (items: ContentItem[]) => void = () => {};
    vi.spyOn(promptModule, 'loadChunk').mockImplementation(
      () =>
        new Promise((resolve) => {
          arrive = resolve;
        }),
    );
    setContent('phrases');
    setScript('hiragana');
    const trainer = createTrainer();
    render(<TrainerPage trainer={trainer} />, container);
    await wait();
    expect(trainer.isLoadingContent.value).toBe(true);
    expect(trainer.noContentForScript.value).toBe(false);

    arrive([phrase]);
    await wait();
    expect(trainer.noContentForScript.value).toBe(false);
    expect(container.querySelector('[data-testid="stage-notice"]')?.textContent).toBe('');
  });
});
