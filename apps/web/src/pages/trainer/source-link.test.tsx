// @vitest-environment happy-dom
import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { render } from 'preact';
import { signal } from '@preact/signals';
import { TrainerPage } from './ui/trainer-page';
import { createTrainer } from '@/features/training';
import type { Trainer } from '@/features/training';
import type { PromptItem } from '@/entities/prompt';
import { setShowTranslation } from '@/entities/settings';
import { loadDictionaryPart } from '@/shared/i18n';

await loadDictionaryPart('type');

const settle = (): Promise<void> => new Promise((resolve) => setTimeout(resolve, 30));

const word: PromptItem = { key: 'w:hiragana:ねこ', text: 'ねこ', meaning: { en: 'cat' } };
const phrase: PromptItem = {
  key: 'p:163818',
  text: 'あにはおーすとらりあにいます。',
  meaning: { en: 'My brother is now in Australia.' },
  tatoebaId: 163818,
};

// Spec "Text stream" (frontend.md) and the TranslationLine design: a phrase has a "source" link to
// its Tatoeba sentence that stays when the translation is off; a word has none.
describe('translation line: the Source link', () => {
  const prompt = signal<PromptItem>(word);
  let container: HTMLDivElement;
  let trainer: Trainer;

  beforeEach(async () => {
    prompt.value = word;
    setShowTranslation(true);
    container = document.createElement('div');
    document.body.appendChild(container);
    trainer = createTrainer({ nextPrompt: () => prompt.value });
    render(<TrainerPage trainer={trainer} />, container);
    await settle();
  });

  afterEach(() => {
    render(null, container);
    container.remove();
    setShowTranslation(true);
  });

  const link = (): HTMLAnchorElement => {
    const a = container.querySelector<HTMLAnchorElement>('[data-testid="source-link"]');
    if (a === null) throw new Error('no source link');
    return a;
  };
  const text = (): string =>
    container.querySelector('[data-testid="translation"]')?.textContent ?? '';

  it('shows the English meaning and no link for a word', () => {
    expect(text()).toBe('cat');
    expect(link().hidden).toBe(true);
  });

  it('links a phrase to its Tatoeba sentence in a new tab, also with the translation off', async () => {
    prompt.value = phrase;
    trainer.restart();
    await settle();
    expect(text()).toBe('My brother is now in Australia.');
    expect(link().hidden).toBe(false);
    expect(link().getAttribute('href')).toBe('https://tatoeba.org/sentences/163818');
    expect(link().target).toBe('_blank');
    expect(link().rel).toBe('noopener');

    setShowTranslation(false);
    await settle();
    expect(text()).toBe('');
    expect(link().hidden).toBe(false);
  });

  it('does not take the keyboard from the field when pressed', () => {
    const event = new MouseEvent('mousedown', { bubbles: true, cancelable: true });
    link().dispatchEvent(event);
    expect(event.defaultPrevented).toBe(true);
  });
});
