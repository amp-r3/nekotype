// @vitest-environment happy-dom
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { render } from 'preact';
import { act } from 'preact/test-utils';
import { App } from './App';
import { createMemoryDb, startRouter } from '@/shared/lib';
import { initSettings } from '@/entities/settings';
import { initUser } from '@/entities/user';
import { setLocale, t } from '@/shared/i18n';

// The link at the right of the navigation (design decisions 65, 120; p5-plan.md, D20).
describe('the sign-in link of the navigation', () => {
  let container: HTMLDivElement;
  let stopRouter: () => void;

  beforeEach(async () => {
    await setLocale('en');
    await initSettings(Promise.resolve(createMemoryDb()));
    window.history.replaceState(null, '', '/type');
    stopRouter = startRouter();
    container = document.createElement('div');
    document.body.appendChild(container);
  });

  afterEach(() => {
    render(null, container);
    container.remove();
    stopRouter();
  });

  const signInLink = (): HTMLAnchorElement | null =>
    Array.from(container.querySelectorAll<HTMLAnchorElement>('header a')).find(
      (a) => a.textContent === t('nav.signIn') || a.textContent === t('nav.signInAgain'),
    ) ?? null;

  async function show(meta: Record<string, unknown>, host: string): Promise<void> {
    const db = createMemoryDb();
    for (const [key, value] of Object.entries(meta)) await db.put('meta', key, value);
    await initUser(db, host);
    await act(() => {
      render(<App />, container);
    });
  }

  it('offers sign in to a guest on the production host, leading to /settings', async () => {
    await show({}, 'nekotype.pages.dev');
    expect(signInLink()?.textContent).toBe(t('nav.signIn'));
    expect(signInLink()?.getAttribute('href')).toBe('/settings');
  });

  it('is not rendered on a preview', async () => {
    await show({}, 'release-candidate.nekotype.pages.dev');
    expect(signInLink()).toBeNull();
  });

  it('is gone after sign-in', async () => {
    await show({ userId: 'user-1' }, 'nekotype.pages.dev');
    expect(signInLink()).toBeNull();
  });

  it('returns as sign in again while the session is expired', async () => {
    await show({ userId: 'user-1', sessionExpired: true }, 'nekotype.pages.dev');
    expect(signInLink()?.textContent).toBe(t('nav.signInAgain'));
    expect(signInLink()?.getAttribute('href')).toBe('/settings');
  });
});
