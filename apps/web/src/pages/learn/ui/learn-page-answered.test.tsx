// @vitest-environment happy-dom
import { describe, it, expect, afterEach, vi } from 'vitest';
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
    vi.unstubAllGlobals();
    await setLocale('en');
  });

  it('shows the streak, in the plural of the language', async () => {
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
          misses: 0,
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

  // The DOM follows the screen at its width (design decision 153): on a desktop the action, then
  // "since the last session", then the path; below 640px the action, the path, then since.
  async function mountAt(desktop: boolean): Promise<string[]> {
    vi.stubGlobal('matchMedia', (query: string) => ({
      matches: desktop && query === '(min-width: 640px)',
      media: query,
      addEventListener: () => undefined,
      removeEventListener: () => undefined,
    }));
    container = document.createElement('div');
    document.body.appendChild(container);
    render(<LearnPage />, container);
    for (let i = 0; i < 100 && container.querySelector('#home-since-title') === null; i++) {
      await act(settle);
    }
    return Array.from(container.querySelectorAll('.nk-home > *')).map(
      (el) => el.className.split(' ').find((c) => c.startsWith('nk-home__')) ?? '',
    );
  }

  it('orders the action, since the last session and the path by width', async () => {
    expect(await mountAt(true)).toEqual(['nk-home__act', 'nk-home__since', 'nk-home__path']);
    render(null, container);
    container.remove();
    expect(await mountAt(false)).toEqual(['nk-home__act', 'nk-home__path', 'nk-home__since']);
  });
});
