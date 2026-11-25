// @vitest-environment happy-dom
import { describe, it, expect, afterEach } from 'vitest';
import { render } from 'preact';
import { act } from 'preact/test-utils';
import { LearnPage } from './learn-page';
import { learnTrack } from '@/entities/settings';
import { t } from '@/shared/i18n';

const settle = (): Promise<void> => new Promise((resolve) => setTimeout(resolve, 30));

// The model is a lazy chunk: wait until the home has its reason instead of guessing the time.
async function until(root: HTMLElement, selector: string): Promise<void> {
  for (let i = 0; i < 100; i += 1) {
    if (root.querySelector(selector)) return;
    await act(settle);
  }
}

describe('learn page: the learning home', () => {
  let container: HTMLDivElement;

  afterEach(() => {
    render(null, container);
    container.remove();
  });

  function mount(): void {
    container = document.createElement('div');
    document.body.appendChild(container);
    render(<LearnPage />, container);
  }

  it('a fresh start reads "next: the vowels", has no streak, no chart and nothing stronger', async () => {
    mount();
    await until(container, '[data-testid="home-reason"]');

    expect(container.querySelector('[data-testid="home-reason"]')?.textContent).toBe(
      'next: the vowels',
    );
    expect(container.querySelector('[data-testid="kana-chart"]')).toBeNull();
    expect(container.querySelector('[data-testid="kana-cell"]')).toBeNull();
    expect(container.querySelector('[data-testid="learn-streak"]')).toBeNull();
    expect(container.querySelector('[data-testid="home-stronger"]')).toBeNull();
    const labels = Array.from(container.querySelectorAll('button')).map((el) => el.textContent);
    expect(labels).toContain(`${t('learn.continue')}${t('key.enter')}`);
  });

  it('draws the path of the track and its forecast once the lazy parts have loaded', async () => {
    mount();
    await until(container, '[data-testid="home-forecast"]');

    expect(container.querySelector('#home-path-title')?.textContent).toBe('path · hiragana');
    const blocks = Array.from(container.querySelectorAll('[data-testid^="home-block-"]'));
    expect(blocks.map((b) => b.getAttribute('data-testid'))).toEqual([
      'home-block-basic',
      'home-block-dakuten',
      'home-block-yoon',
    ]);
    // The current block is open and the radiogroup selects it; only its rows are listed.
    expect(blocks.map((b) => b.getAttribute('aria-checked'))).toEqual(['true', 'false', 'false']);
    expect(container.querySelector('#home-path-basic')).not.toBeNull();
    expect(container.querySelector('#home-path-dakuten')).toBeNull();
    const current = container.querySelector('[aria-current="step"]');
    expect(current?.getAttribute('aria-label')).toBe('the vowels: 0 of 5 open, you are here');
    // No answers yet: the forecast is from the model's prediction, a rough estimate.
    expect(container.querySelector('[data-testid="home-forecast"]')?.textContent).toContain(
      'A rough estimate for now.',
    );
    expect(container.querySelector('[data-testid="home-forecast"]')?.textContent).toMatch(
      /^all the vowels open in (about \d+ sessions?|\d+–\d+ sessions)/,
    );
  });

  it('opens another block with a click and closes the first', async () => {
    mount();
    await until(container, '[data-testid="home-block-dakuten"]');
    const dakuten = container.querySelector('[data-testid="home-block-dakuten"]');
    await act(() => {
      dakuten?.dispatchEvent(new MouseEvent('click', { bubbles: true }));
    });
    expect(
      Array.from(container.querySelectorAll('[data-testid^="home-block-"]')).map((b) =>
        b.getAttribute('aria-checked'),
      ),
    ).toEqual(['false', 'true', 'false']);
  });

  it('keeps the hidden field out of the Tab order and out of the tree on the home view', async () => {
    mount();
    await until(container, '[data-testid="home-reason"]');
    const field = container.querySelector('input');
    expect(field?.tabIndex).toBe(-1);
    expect(field?.getAttribute('aria-hidden')).toBe('true');
  });

  it('gives `continue` the focus once the screen is ready, and names the buttons in lower case', async () => {
    mount();
    for (
      let i = 0;
      i < 100 && !document.activeElement?.textContent.startsWith(t('learn.continue'));
      i += 1
    ) {
      await act(settle);
    }
    expect(document.activeElement?.textContent).toBe(`${t('learn.continue')}${t('key.enter')}`);
    expect(t('learn.continue')).toBe('continue');
  });

  it('switches the track: the path, and with it its four blocks and the reason, follow', async () => {
    mount();
    await until(container, '[data-testid="home-block-basic"]');

    const katakana = Array.from(container.querySelectorAll('[role="radio"]')).find(
      (el) => el.textContent === t('learn.track.katakana'),
    );
    expect(katakana).toBeDefined();
    await act(() => {
      katakana?.dispatchEvent(new MouseEvent('click', { bubbles: true }));
    });

    expect(learnTrack.value).toBe('katakana');
    expect(container.querySelector('#home-path-title')?.textContent).toBe('path · katakana');
    expect(container.querySelectorAll('[data-testid^="home-block-"]')).toHaveLength(4);
    expect(container.querySelector('[data-testid="home-reason"]')?.textContent).toBe(
      'next: the vowels',
    );
  });
});
