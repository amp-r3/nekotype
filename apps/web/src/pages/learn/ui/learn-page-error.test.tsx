// @vitest-environment happy-dom
import { describe, it, expect, afterEach } from 'vitest';
import { render } from 'preact';
import { act } from 'preact/test-utils';
import { getDatabase } from '@/shared/lib';
import { t } from '@/shared/i18n';
import { LearnPage } from './learn-page';
import { key, seedLog } from '../lib/test-util';

const settle = (): Promise<void> => new Promise((resolve) => setTimeout(resolve, 30));

describe('learn page: the progress cannot be read', () => {
  let container: HTMLDivElement;

  afterEach(() => {
    render(null, container);
    container.remove();
  });

  it('says so with a retry, keeps the actions off and the table away, and recovers on retry', async () => {
    const db = await getDatabase();
    await seedLog(db, Date.now() - 60_000, (store) => {
      store.introduce(key('あ'));
    });
    const stored = await db.getAll('log');
    expect(stored).not.toHaveLength(0);
    const read = db.getAll.bind(db);
    let failing = true;
    db.getAll = (store) => (failing ? Promise.reject(new Error('closed')) : read(store));

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
    // The stored log was never replaced by an empty one: the page shows it after the retry.
    expect(await db.getAll('log')).toEqual(stored);
    expect(
      container.querySelectorAll('[data-testid="kana-cell"]:not([data-state="locked"])'),
    ).toHaveLength(1);
  });
});
