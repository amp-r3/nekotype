// @vitest-environment happy-dom
import { describe, it, expect, afterEach } from 'vitest';
import { render } from 'preact';
import { act } from 'preact/test-utils';
import { LearnPage } from './learn-page';
import { learnTrack } from '@/entities/settings';
import { t } from '@/shared/i18n';

const settle = (): Promise<void> => new Promise((resolve) => setTimeout(resolve, 30));

function unlockedKana(root: HTMLElement): string {
  return Array.from(root.querySelectorAll('[data-testid="kana-cell"]:not([data-state="locked"])'))
    .map((cell) => cell.textContent)
    .join('');
}

describe('learn page: the top of the learning screen', () => {
  let container: HTMLDivElement;

  afterEach(() => {
    render(null, container);
    container.remove();
  });

  it('shows the unlocked kana of the selected track once the state has loaded', async () => {
    container = document.createElement('div');
    document.body.appendChild(container);
    render(<LearnPage />, container);
    await act(settle);

    expect(container.querySelector('[data-testid="learn-mastered-count"]')?.textContent).toBe(
      t('learn.mastered', { done: 0, total: 104 }),
    );
    expect(unlockedKana(container)).toBe('あいうえお');
  });

  it('hides the streak before the first answer and shows the first-visit line instead', async () => {
    container = document.createElement('div');
    document.body.appendChild(container);
    render(<LearnPage />, container);
    await act(settle);
    expect(container.querySelector('[data-testid="learn-streak"]')).toBeNull();
    expect(container.querySelector('[data-testid="learn-first"]')?.textContent).toBe(
      t('learn.first', { kana: 'あ い う え お' }),
    );
  });

  it('gives `continue` the focus once the screen is ready, and names the buttons in lower case', async () => {
    container = document.createElement('div');
    document.body.appendChild(container);
    render(<LearnPage />, container);
    await act(settle);
    expect(document.activeElement?.textContent).toBe(t('learn.continue'));
    expect(t('learn.continue')).toBe('continue');
  });

  it('switches the track', async () => {
    container = document.createElement('div');
    document.body.appendChild(container);
    render(<LearnPage />, container);
    await act(settle);

    const katakana = Array.from(container.querySelectorAll('[role="radio"]')).find(
      (el) => el.textContent === t('learn.track.katakana'),
    );
    expect(katakana).toBeDefined();
    await act(() => {
      katakana?.dispatchEvent(new MouseEvent('click', { bubbles: true }));
    });

    expect(container.querySelector('[data-testid="learn-mastered-count"]')?.textContent).toBe(
      t('learn.mastered', { done: 0, total: 125 }),
    );
    expect(container.querySelector('[data-testid="learn-first"]')?.textContent).toBe(
      t('learn.first', { kana: 'ア イ ウ エ オ' }),
    );
    expect(unlockedKana(container)).toBe('アイウエオ');
    expect(learnTrack.value).toBe('katakana');
  });
});

describe('learn page: review', () => {
  it('disables "Review (N)" while nothing is due', async () => {
    const container = document.createElement('div');
    document.body.appendChild(container);
    render(<LearnPage />, container);
    await act(settle);
    const button = Array.from(container.querySelectorAll('button')).find(
      (el) => el.textContent === t('learn.review', { n: 0 }),
    );
    expect(button).toBeDefined();
    expect(button?.hasAttribute('disabled')).toBe(true);
    render(null, container);
    container.remove();
  });
});
