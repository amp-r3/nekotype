// @vitest-environment happy-dom
import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { render } from 'preact';
import { App } from './App';
import { createMemoryDb, currentPath, navigate, startRouter } from '@/shared/lib';
import { initSettings } from '@/entities/settings';
import { setLocale, t } from '@/shared/i18n';

const settle = (): Promise<void> => new Promise((resolve) => setTimeout(resolve, 30));

describe('App shell: navigation, lazy screens and the unknown path', () => {
  let container: HTMLDivElement;
  let stopRouter: () => void;

  beforeEach(async () => {
    await setLocale('en');
    await initSettings(Promise.resolve(createMemoryDb()));
    window.history.replaceState(null, '', '/');
    stopRouter = startRouter();
    container = document.createElement('div');
    document.body.appendChild(container);
  });

  afterEach(() => {
    render(null, container);
    container.remove();
    stopRouter();
  });

  it('shows the learning screen at / with the navigation and the footer', async () => {
    render(<App />, container);
    const nav = container.querySelector('nav');
    expect(nav?.getAttribute('aria-label')).toBe(t('nav.label'));
    expect(Array.from(nav?.querySelectorAll('a') ?? []).map((a) => a.getAttribute('href'))).toEqual(
      ['/', '/progress', '/settings'],
    );
    expect(nav?.querySelector('[aria-current="page"]')?.getAttribute('href')).toBe('/');
    expect(container.querySelector('footer a')?.getAttribute('href')).toBe('/about');
    await vi.waitFor(() => {
      expect(container.querySelector('h1')?.textContent).toBe(t('page.learn'));
    });
    expect(container.querySelector('[data-testid="prompt-arena"]')).toBeNull();
  });

  it('a click on a link opens its screen without a page load, and Back returns', async () => {
    render(<App />, container);
    const marker = window.history.length;

    const stats = container.querySelector<HTMLAnchorElement>('nav a[href="/progress"]');
    stats?.dispatchEvent(new MouseEvent('click', { bubbles: true, cancelable: true, button: 0 }));
    await vi.waitFor(() => {
      expect(container.querySelector('h1')?.textContent).toBe(t('page.progress'));
    });

    expect(window.location.pathname).toBe('/progress');
    expect(window.history.length).toBe(marker + 1);
    expect(container.querySelector('nav [aria-current="page"]')?.getAttribute('href')).toBe(
      '/progress',
    );

    window.history.replaceState(null, '', '/');
    window.dispatchEvent(new PopStateEvent('popstate'));
    await vi.waitFor(() => {
      expect(container.querySelector('h1')?.textContent).toBe(t('page.learn'));
    });
  });

  it('a modified click is left to the browser', async () => {
    render(<App />, container);
    const stats = container.querySelector<HTMLAnchorElement>('nav a[href="/progress"]');
    const event = new MouseEvent('click', {
      bubbles: true,
      cancelable: true,
      button: 0,
      ctrlKey: true,
    });
    stats?.dispatchEvent(event);
    await settle();
    // The browser opens it in a new tab; the router did not take the click.
    expect(event.defaultPrevented).toBe(false);
    expect(currentPath.value).toBe('/');
  });

  it('every other screen opens from its address', async () => {
    for (const [path, title] of [
      ['/progress', 'page.progress'],
      ['/settings', 'page.settings'],
      ['/about', 'page.about'],
    ] as const) {
      navigate(path);
      render(<App />, container);
      await vi.waitFor(() => {
        expect(container.querySelector('h1')?.textContent).toBe(t(title));
      });
      render(null, container);
    }
  });

  it('an unknown path shows a not-found screen with a way home', async () => {
    window.history.replaceState(null, '', '/nope');
    stopRouter();
    stopRouter = startRouter();
    render(<App />, container);
    expect(container.querySelector('h1')?.textContent).toBe(t('notFound.title'));
    expect(container.textContent).toContain(t('notFound.text'));

    const home = Array.from(container.querySelectorAll('button')).find((b) =>
      b.textContent.startsWith(t('notFound.home')),
    );
    home?.click();
    await settle();
    expect(window.location.pathname).toBe('/');
    expect(container.querySelector('h1')?.textContent).toBe(t('page.learn'));
  });

  it('/type is gone: it shows the not-found screen, and the navigation has no link to it', () => {
    window.history.replaceState(null, '', '/type');
    stopRouter();
    stopRouter = startRouter();
    render(<App />, container);
    expect(container.querySelector('h1')?.textContent).toBe(t('notFound.title'));
    expect(container.querySelector('nav a[href="/type"]')).toBeNull();
  });

  it('Enter on the not-found screen goes home', async () => {
    window.history.replaceState(null, '', '/nope');
    stopRouter();
    stopRouter = startRouter();
    render(<App />, container);
    document.body.dispatchEvent(new KeyboardEvent('keydown', { key: 'Enter', bubbles: true }));
    await settle();
    expect(window.location.pathname).toBe('/');
  });

  it('the language switch marks the chosen language and switches the other one', async () => {
    render(<App />, container);
    const buttons = () =>
      Array.from(
        container.querySelectorAll<HTMLButtonElement>(
          '[aria-label="' + t('app.language') + '"] button',
        ),
      );
    expect(buttons().map((b) => b.getAttribute('aria-pressed'))).toEqual(['true', 'false']);
    buttons()[1]?.click();
    // The Russian dictionary is a chunk: the choice is applied when it has loaded.
    await vi.waitFor(() => {
      expect(buttons().map((b) => b.getAttribute('aria-pressed'))).toEqual(['false', 'true']);
    });
  });

  it('the navigation follows the interface language', async () => {
    render(<App />, container);
    await setLocale('ru');
    await settle();
    expect(container.querySelector('nav a[href="/"]')?.textContent).toBe('обучение');
  });
});
