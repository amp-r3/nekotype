import type { ReadonlySignal } from '@preact/signals';
import { signal } from '@preact/signals';

// Dependency-free client router on the History API. It knows paths only: no query, hash or
// parameters, because the application has five fixed screens.

function normalize(pathname: string): string {
  const trimmed = pathname.replace(/\/+$/, '');
  return trimmed === '' ? '/' : trimmed;
}

function locationPath(): string {
  return typeof window === 'undefined' ? '/' : normalize(window.location.pathname);
}

const _path = signal<string>(locationPath());

/** The path on display, without a trailing slash. */
export const currentPath: ReadonlySignal<string> = _path;

/** Shows another path and adds a history entry. The same path is a no-op. */
export function navigate(to: string, options: { readonly replace?: boolean } = {}): void {
  const next = normalize(to);
  if (next === _path.value) return;
  if (options.replace === true) {
    window.history.replaceState(null, '', next);
  } else {
    window.history.pushState(null, '', next);
  }
  _path.value = next;
}

/** Follows the back and forward buttons. Returns the function that stops it. */
export function startRouter(): () => void {
  const onPopState = (): void => {
    _path.value = locationPath();
  };
  _path.value = locationPath();
  window.addEventListener('popstate', onPopState);
  return () => {
    window.removeEventListener('popstate', onPopState);
  };
}

/** A plain left click: the browser's own handling (new tab, download) must stay untouched. */
export function isPlainLeftClick(
  event: Pick<
    MouseEvent,
    'button' | 'metaKey' | 'ctrlKey' | 'shiftKey' | 'altKey' | 'defaultPrevented'
  >,
): boolean {
  return (
    !event.defaultPrevented &&
    event.button === 0 &&
    !event.metaKey &&
    !event.ctrlKey &&
    !event.shiftKey &&
    !event.altKey
  );
}

const _immersive = signal(false);

/**
 * True while a screen takes the whole window, a learning session for one: the navigation and the
 * footer are not drawn.
 */
export const immersive: ReadonlySignal<boolean> = _immersive;

export function setImmersive(on: boolean): void {
  _immersive.value = on;
}
