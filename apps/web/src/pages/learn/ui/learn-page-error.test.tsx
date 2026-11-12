// @vitest-environment happy-dom
import { describe, it, expect, afterEach } from 'vitest';
import { render } from 'preact';
import { act } from 'preact/test-utils';
import { getDatabase } from '@/shared/lib';
import { t } from '@/shared/i18n';
import { initialCounters, initialLearnState } from '@/entities/learn';
import { LearnPage } from './learn-page';

const settle = (): Promise<void> => new Promise((resolve) => setTimeout(resolve, 30));

describe('learn page: the progress cannot be read', () => {
  let container: HTMLDivElement;

  afterEach(() => {
    render(null, container);
    container.remove();
  });

  it('says so with a retry, keeps the actions off and the table away, and recovers on retry', async () => {
    const stored = {
      learn: {
        ...initialLearnState(),
        entries: { 'hiragana:あ': { box: 1, dueAt: 1, updatedAt: 1 } },
      },
      counters: initialCounters(),
    };
    const db = await getDatabase();
    await db.put('delta', 'learn', stored);
    const read = db.get.bind(db);
    let failing = true;
    db.get = (store, key) => (failing ? Promise.reject(new Error('closed')) : read(store, key));

    container = document.createElement('div');
    document.body.appendChild(container);
    render(<LearnPage />, container);
    await act(settle);

    const buttons = (): HTMLButtonElement[] => Array.from(container.querySelectorAll('button'));
    const byText = (text: string): HTMLButtonElement | undefined =>
      buttons().find((button) => button.textContent === text);
    expect(container.textContent).toContain(t('learn.loadError'));
    expect(container.querySelector('[data-testid="kana-chart"]')).toBeNull();
    expect(byText(t('learn.continue'))?.disabled).toBe(true);
    expect(byText(t('learn.review', { n: 0 }))?.disabled).toBe(true);
    // The numbers of an unread state are not shown as if they were real.
    expect(container.querySelector('[data-testid="learn-mastered-count"]')).toBeNull();

    failing = false;
    await act(async () => {
      byText(t('learn.retry'))?.click();
      await settle();
    });
    expect(container.textContent).not.toContain(t('learn.loadError'));
    expect(container.querySelector('[data-testid="kana-chart"]')).not.toBeNull();
    expect(byText(t('learn.continue'))?.disabled).toBe(false);
    // The stored record was never replaced by the initial state: the entry is still there.
    expect(await db.get('delta', 'learn')).toEqual(stored);
  });
});
