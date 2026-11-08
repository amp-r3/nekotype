// @vitest-environment happy-dom
import { describe, it, expect, afterEach } from 'vitest';
import { render } from 'preact';
import { act } from 'preact/test-utils';
import { LearnPage } from './learn-page';
import { learnTrack } from '@/entities/settings';
import { t } from '@/shared/i18n';

const settle = (): Promise<void> => new Promise((resolve) => setTimeout(resolve, 30));

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
    expect(container.querySelector('[data-testid="learn-unlocked-list"]')?.textContent).toBe(
      'あ い う え お',
    );
  });

  it('shows no streak before the first answer', async () => {
    container = document.createElement('div');
    document.body.appendChild(container);
    render(<LearnPage />, container);
    await act(settle);
    expect(container.querySelector('[data-testid="learn-streak"]')?.textContent).toBe(
      t('learn.streak', { days: 0 }),
    );
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
    expect(container.querySelector('[data-testid="learn-unlocked-list"]')?.textContent).toBe(
      'ア イ ウ エ オ',
    );
    expect(learnTrack.value).toBe('katakana');
  });
});
