// @vitest-environment happy-dom
import { afterEach, describe, expect, it, vi } from 'vitest';
import { render } from 'preact';
import { act } from 'preact/test-utils';
import { ModePanel } from './mode-panel';
import { loadDictionaryPart } from '@/shared/i18n';

// The route brings the strings of the screen; here the test does.
await loadDictionaryPart('type');

let container: HTMLDivElement;

async function mount(narrow: boolean): Promise<void> {
  vi.stubGlobal('matchMedia', (query: string) => ({
    matches: query.includes('max-width') ? narrow : false,
    media: query,
    addEventListener: () => undefined,
    removeEventListener: () => undefined,
  }));
  container = document.createElement('div');
  document.body.appendChild(container);
  await act(() => {
    render(<ModePanel />, container);
  });
}

const radios = (): number => container.querySelectorAll('[role="radio"]').length;

afterEach(() => {
  render(null, container);
  container.remove();
  vi.unstubAllGlobals();
});

describe('ModePanel', () => {
  it('shows the whole bar on a wide screen', async () => {
    await mount(false);
    expect(container.querySelector('button[aria-expanded]')).toBeNull();
    expect(radios()).toBeGreaterThan(3);
  });

  it('folds into one line below 640 px and opens by its button', async () => {
    await mount(true);
    const toggle = container.querySelector('button[aria-expanded]');
    expect(toggle?.getAttribute('aria-expanded')).toBe('false');
    expect(toggle?.textContent).toMatch(/^words · .+ · relaxed · 30 s$/);
    expect(radios()).toBe(0);
    await act(() => {
      toggle?.dispatchEvent(new MouseEvent('click', { bubbles: true }));
    });
    expect(container.querySelector('button[aria-expanded="true"]')).not.toBeNull();
    expect(radios()).toBeGreaterThan(3);
  });
});
