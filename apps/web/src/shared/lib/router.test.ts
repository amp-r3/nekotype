// @vitest-environment happy-dom
import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { currentPath, navigate, startRouter, isPlainLeftClick } from './router';

describe('router: History API without dependencies', () => {
  let stop: () => void;

  beforeEach(() => {
    window.history.replaceState(null, '', '/');
    stop = startRouter();
  });

  afterEach(() => {
    stop();
  });

  it('starts at the current location', () => {
    stop();
    window.history.replaceState(null, '', '/progress');
    stop = startRouter();
    expect(currentPath.value).toBe('/progress');
  });

  it('navigate shows the path and adds a history entry', () => {
    const before = window.history.length;
    navigate('/learn');
    expect(currentPath.value).toBe('/learn');
    expect(window.location.pathname).toBe('/learn');
    expect(window.history.length).toBe(before + 1);
  });

  it('navigating to the path already shown adds nothing', () => {
    navigate('/learn');
    const length = window.history.length;
    navigate('/learn');
    expect(window.history.length).toBe(length);
  });

  it('replace swaps the entry instead of adding one', () => {
    navigate('/learn');
    const length = window.history.length;
    navigate('/about', { replace: true });
    expect(window.history.length).toBe(length);
    expect(currentPath.value).toBe('/about');
  });

  it('a trailing slash is the same path', () => {
    navigate('/settings/');
    expect(currentPath.value).toBe('/settings');
    navigate('//');
    expect(currentPath.value).toBe('/');
  });

  it('follows popstate (the back button)', () => {
    navigate('/learn');
    window.history.replaceState(null, '', '/progress');
    window.dispatchEvent(new PopStateEvent('popstate'));
    expect(currentPath.value).toBe('/progress');
  });

  it('replaces a retired path with its target, on start and on popstate', () => {
    stop();
    window.history.replaceState(null, '', '/old/');
    const length = window.history.length;
    stop = startRouter({ '/old': '/new' });
    expect(currentPath.value).toBe('/new');
    expect(window.location.pathname).toBe('/new');
    expect(window.history.length).toBe(length);

    window.history.replaceState(null, '', '/old');
    window.dispatchEvent(new PopStateEvent('popstate'));
    expect(currentPath.value).toBe('/new');
    expect(window.location.pathname).toBe('/new');
  });

  it('stops following after the returned function is called', () => {
    stop();
    window.history.replaceState(null, '', '/about');
    window.dispatchEvent(new PopStateEvent('popstate'));
    expect(currentPath.value).not.toBe('/about');
    stop = startRouter();
  });

  it('lets the browser handle modified and non-left clicks', () => {
    const base = {
      button: 0,
      metaKey: false,
      ctrlKey: false,
      shiftKey: false,
      altKey: false,
      defaultPrevented: false,
    };
    expect(isPlainLeftClick(base)).toBe(true);
    expect(isPlainLeftClick({ ...base, ctrlKey: true })).toBe(false);
    expect(isPlainLeftClick({ ...base, metaKey: true })).toBe(false);
    expect(isPlainLeftClick({ ...base, shiftKey: true })).toBe(false);
    expect(isPlainLeftClick({ ...base, altKey: true })).toBe(false);
    expect(isPlainLeftClick({ ...base, button: 1 })).toBe(false);
    expect(isPlainLeftClick({ ...base, defaultPrevented: true })).toBe(false);
  });
});
