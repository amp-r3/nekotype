// @vitest-environment happy-dom
import { describe, it, expect, afterEach } from 'vitest';
import { render } from 'preact';
import { act } from 'preact/test-utils';
import { getDatabase } from '@/shared/lib';
import { locale, setLocale, tPlural } from '@/shared/i18n';
import { initialCounters, initialLearnState, localDay } from '@/entities/learn';
import { LearnPage } from './learn-page';

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
    const today = localDay(Date.now());
    const db = await getDatabase();
    await db.put('delta', 'current', {
      learn: { ...initialLearnState(), activeDays: [[today - 5, today]] },
      counters: initialCounters(),
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
