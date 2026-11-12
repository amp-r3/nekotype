// @vitest-environment happy-dom
import { describe, it, expect, afterEach, vi } from 'vitest';
import { render } from 'preact';
import { Pagination } from './pagination';

let container: HTMLDivElement;

const LABELS = { prev: '← newer', next: 'older →', label: 'history pages' };

function mount(page: number, pages: number, onPage: (page: number) => void = () => {}): string[] {
  container = document.createElement('div');
  document.body.append(container);
  render(<Pagination page={page} pages={pages} onPage={onPage} labels={LABELS} />, container);
  return Array.from(container.querySelector('nav')?.children ?? []).map((item) => item.textContent);
}

const button = (text: string): HTMLButtonElement | undefined =>
  Array.from(container.querySelectorAll('button')).find((item) => item.textContent === text);

afterEach(() => {
  render(null, container);
  container.remove();
});

describe('Pagination', () => {
  it('shows the first, the last and the neighbouring pages, "…" for the rest', () => {
    expect(mount(1, 12)).toEqual(['← newer', '1', '2', '…', '12', 'older →']);
    render(null, container);
    container.remove();
    expect(mount(6, 12)).toEqual(['← newer', '1', '…', '5', '6', '7', '…', '12', 'older →']);
    render(null, container);
    container.remove();
    expect(mount(2, 3)).toEqual(['← newer', '1', '2', '3', 'older →']);
  });

  it('names the navigation and marks the current page', () => {
    mount(2, 3);
    expect(container.querySelector('nav')?.getAttribute('aria-label')).toBe('history pages');
    expect(button('2')?.getAttribute('aria-current')).toBe('page');
    expect(button('1')?.hasAttribute('aria-current')).toBe(false);
  });

  it('disables the edge buttons at the edges', () => {
    mount(1, 3);
    expect(button('← newer')?.disabled).toBe(true);
    expect(button('older →')?.disabled).toBe(false);
    render(null, container);
    container.remove();
    mount(3, 3);
    expect(button('← newer')?.disabled).toBe(false);
    expect(button('older →')?.disabled).toBe(true);
  });

  it('reports the page asked for, not the current one', () => {
    const onPage = vi.fn();
    mount(5, 12, onPage);
    button('← newer')?.click();
    button('older →')?.click();
    button('12')?.click();
    button('5')?.click();
    expect(onPage.mock.calls).toEqual([[4], [6], [12]]);
  });
});
