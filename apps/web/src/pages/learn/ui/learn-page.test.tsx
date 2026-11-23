// @vitest-environment happy-dom
import { describe, it, expect, afterEach } from 'vitest';
import { render } from 'preact';
import { act } from 'preact/test-utils';
import { LearnPage } from './learn-page';
import { learnTrack } from '@/entities/settings';
import { t } from '@/shared/i18n';

const settle = (): Promise<void> => new Promise((resolve) => setTimeout(resolve, 30));

// The model is a lazy chunk: wait until the chart is drawn instead of guessing the time.
async function untilChart(root: HTMLElement): Promise<void> {
  for (let i = 0; i < 100; i += 1) {
    if (root.querySelector('[data-testid="kana-cell"]')) return;
    await act(settle);
  }
}

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

  it('shows the progress and a chart of locked kana once the log has loaded', async () => {
    container = document.createElement('div');
    document.body.appendChild(container);
    render(<LearnPage />, container);
    await untilChart(container);

    expect(container.querySelector('[data-testid="learn-mastered-count"]')?.textContent).toBe(
      t('learn.mastered', { done: 0, total: 104 }),
    );
    expect(container.querySelectorAll('[data-testid="kana-cell"]')).toHaveLength(104);
    expect(unlockedKana(container)).toBe('');
    // Nothing is due: the part is not there, and there is no review button.
    expect(container.querySelector('[data-testid="learn-due"]')).toBeNull();
    const labels = Array.from(container.querySelectorAll('button')).map((el) => el.textContent);
    expect(labels).toContain(t('learn.continue'));
    expect(labels.filter((label) => label.startsWith('review'))).toEqual([]);
  });

  it('keeps the hidden field out of the Tab order and out of the tree on the home view', async () => {
    container = document.createElement('div');
    document.body.appendChild(container);
    render(<LearnPage />, container);
    await untilChart(container);
    const field = container.querySelector('input');
    expect(field?.tabIndex).toBe(-1);
    expect(field?.getAttribute('aria-hidden')).toBe('true');
  });

  it('hides the streak before the first answer and shows the first-visit line instead', async () => {
    container = document.createElement('div');
    document.body.appendChild(container);
    render(<LearnPage />, container);
    await untilChart(container);
    expect(container.querySelector('[data-testid="learn-streak"]')).toBeNull();
    expect(container.querySelector('[data-testid="learn-first"]')?.textContent).toBe(
      t('learn.first', { kana: 'あ い う え お' }),
    );
  });

  it('gives `continue` the focus once the screen is ready, and names the buttons in lower case', async () => {
    container = document.createElement('div');
    document.body.appendChild(container);
    render(<LearnPage />, container);
    for (
      let i = 0;
      i < 100 && document.activeElement?.textContent !== t('learn.continue');
      i += 1
    ) {
      await act(settle);
    }
    expect(document.activeElement?.textContent).toBe(t('learn.continue'));
    expect(t('learn.continue')).toBe('continue');
  });

  it('switches the track', async () => {
    container = document.createElement('div');
    document.body.appendChild(container);
    render(<LearnPage />, container);
    await untilChart(container);

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
    expect(unlockedKana(container)).toBe('');
    expect(learnTrack.value).toBe('katakana');
  });
});
