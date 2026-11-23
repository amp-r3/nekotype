// @vitest-environment happy-dom
import { describe, it, expect, afterEach } from 'vitest';
import { render } from 'preact';
import { act } from 'preact/test-utils';
import { getDatabase } from '@/shared/lib';
import { locale, setLocale, tPlural } from '@/shared/i18n';
import { LearnPage } from './learn-page';
import { key, seedLog } from '../lib/test-util';

// A file of its own: the learning store is read once per page load, so the record is seeded before
// the page first renders.

const settle = (): Promise<void> => new Promise((resolve) => setTimeout(resolve, 30));

describe('learn page: after the first answer', () => {
  let container: HTMLDivElement;

  afterEach(async () => {
    render(null, container);
    container.remove();
    await setLocale('en');
  });

  it('shows the streak, in the plural of the language, and not the first-visit line', async () => {
    const db = await getDatabase();
    // One answer a day for six days, the last of them now.
    await seedLog(db, Date.now() - 5 * 86_400_000, (store, clock) => {
      store.introduce(key('あ'));
      for (let day = 0; day < 6; day++) {
        store.recordAnswer({
          task: 'recall',
          key: key('あ'),
          ok: true,
          keystrokes: [{ t: 700, accepted: true }],
          hint: false,
          wrong: null,
          alt: null,
        });
        clock.time += 86_400_000;
      }
      // The clock ran one day past the last answer: bring it back to that day.
      clock.time -= 86_400_000;
    });

    container = document.createElement('div');
    document.body.appendChild(container);
    render(<LearnPage />, container);
    await act(settle);

    const streak = (): string | null | undefined =>
      container.querySelector('[data-testid="learn-streak"]')?.textContent;
    expect(streak()).toBe('streak: 6 days');
    expect(container.querySelector('[data-testid="learn-first"]')).toBeNull();

    // The number is set apart in its own span.
    expect(container.querySelector('[data-testid="learn-streak"] .font-mono')?.textContent).toBe(
      '6',
    );

    await act(async () => {
      await setLocale('ru');
    });
    expect(locale.value).toBe('ru');
    expect(streak()).toBe(tPlural('learn.streak', 6));
    expect(streak()).toBe('серия: 6 дней');
  });
});
