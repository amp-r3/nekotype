// @vitest-environment happy-dom
import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { render, options, Fragment } from 'preact';
import type { VNode } from 'preact';
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
      ['/', '/type', '/stats', '/settings'],
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

    const type = container.querySelector<HTMLAnchorElement>('nav a[href="/type"]');
    type?.dispatchEvent(new MouseEvent('click', { bubbles: true, cancelable: true, button: 0 }));
    await vi.waitFor(() => {
      expect(container.querySelector('[data-testid="prompt-arena"]')).not.toBeNull();
    });

    expect(window.location.pathname).toBe('/type');
    expect(window.history.length).toBe(marker + 1);
    expect(container.querySelector('nav [aria-current="page"]')?.getAttribute('href')).toBe(
      '/type',
    );

    window.history.replaceState(null, '', '/');
    window.dispatchEvent(new PopStateEvent('popstate'));
    await vi.waitFor(() => {
      expect(container.querySelector('h1')?.textContent).toBe(t('page.learn'));
    });
  });

  it('a modified click is left to the browser', async () => {
    render(<App />, container);
    const stats = container.querySelector<HTMLAnchorElement>('nav a[href="/stats"]');
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
      ['/stats', 'page.stats'],
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

describe('App shell: a keystroke renders nothing but the stream', () => {
  let container: HTMLDivElement;
  let stopRouter: () => void;
  let prevDiffed: ((vnode: VNode) => void) | undefined;

  beforeEach(async () => {
    await setLocale('en');
    window.history.replaceState(null, '', '/type');
    stopRouter = startRouter();
    container = document.createElement('div');
    document.body.appendChild(container);
    prevDiffed = options.diffed?.bind(options);
  });

  afterEach(() => {
    if (prevDiffed) {
      options.diffed = prevDiffed;
    } else {
      delete options.diffed;
    }
    render(null, container);
    container.remove();
    stopRouter();
  });

  it('with the navigation, the mode panel and the route in the page, only the stream renders', async () => {
    render(<App />, container);
    await vi.waitFor(() => {
      expect(container.querySelector('input')).not.toBeNull();
    });
    await settle();

    const rendered = new Set<string>();
    options.diffed = (vnode: VNode) => {
      // A Fragment wraps a list of children; it is Preact's, not a component of ours.
      if (typeof vnode.type === 'function' && vnode.type !== Fragment) {
        rendered.add(vnode.type.name);
      }
      if (prevDiffed) prevDiffed(vnode);
    };

    // Whatever the prompts are, some of these keys complete one and the stream renders.
    const input = container.querySelector('input');
    for (const key of 'kakikukekokakikuke') {
      input?.dispatchEvent(new KeyboardEvent('keydown', { key, bubbles: true, cancelable: true }));
      await new Promise((resolve) => setTimeout(resolve, 0));
    }
    expect([...rendered].filter((name) => name !== 'TextStream')).toEqual([]);
  });
});
