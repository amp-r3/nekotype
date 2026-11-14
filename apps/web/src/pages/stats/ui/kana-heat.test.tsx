// @vitest-environment happy-dom
import { describe, it, expect, afterEach } from 'vitest';
import { render } from 'preact';
import { act } from 'preact/test-utils';
import { loadDictionaryPart } from '@/shared/i18n';
import { heatRows } from '../lib/kana-heat';
import { KanaHeat } from './kana-heat';

await loadDictionaryPart('stats');

let container: HTMLDivElement;

afterEach(() => {
  render(null, container);
  container.remove();
});

function mount(stats = {}): void {
  container = document.createElement('div');
  document.body.append(container);
  render(<KanaHeat rows={heatRows('hiragana', stats)} ariaLabel="weak kana" />, container);
}

const cells = (): HTMLButtonElement[] =>
  Array.from(container.querySelectorAll<HTMLButtonElement>('[data-testid="heat-cell"]'));

describe('KanaHeat', () => {
  it('tints typed kana and outlines the rest', () => {
    mount({
      'hiragana:あ': { attempts: 10, erroredAttempts: 1 },
      'hiragana:い': { attempts: 5, erroredAttempts: 0 },
    });
    const all = cells();
    expect(all).toHaveLength(104);
    expect(all.find((cell) => cell.dataset['kana'] === 'あ')?.classList.contains('is-heat-3')).toBe(
      true,
    );
    expect(all.find((cell) => cell.dataset['kana'] === 'い')?.classList.contains('is-heat-0')).toBe(
      true,
    );
    expect(
      all.find((cell) => cell.dataset['kana'] === 'う')?.classList.contains('is-untyped'),
    ).toBe(true);
  });

  it('labels a cell with the rate and the attempts, or says it is not typed', () => {
    mount({ 'hiragana:あ': { attempts: 10, erroredAttempts: 1 } });
    const all = cells();
    expect(all.find((cell) => cell.dataset['kana'] === 'あ')?.getAttribute('aria-label')).toBe(
      'あ · a, errors 10% · 10 attempts',
    );
    expect(all.find((cell) => cell.dataset['kana'] === 'う')?.getAttribute('aria-label')).toBe(
      'う · u, not typed yet',
    );
  });

  it('has one tab stop and moves it with the arrows', async () => {
    mount();
    const all = cells();
    expect(all.filter((cell) => cell.tabIndex === 0)).toHaveLength(1);
    all[0]?.focus();
    await act(() => {
      all[0]?.dispatchEvent(new KeyboardEvent('keydown', { key: 'ArrowRight', bubbles: true }));
    });
    expect(document.activeElement).toBe(all[1]);
    expect(cells().filter((cell) => cell.tabIndex === 0)).toEqual([all[1]]);
    await act(() => {
      all[1]?.dispatchEvent(new KeyboardEvent('keydown', { key: 'ArrowLeft', bubbles: true }));
      all[0]?.dispatchEvent(new KeyboardEvent('keydown', { key: 'ArrowLeft', bubbles: true }));
    });
    expect(document.activeElement).toBe(all[0]);
  });

  it('shows the tooltip of the focused cell and the legend', async () => {
    mount({ 'hiragana:あ': { attempts: 10, erroredAttempts: 1 } });
    await act(() => {
      cells()[0]?.focus();
    });
    expect(container.querySelector('[data-testid="heat-tooltip"]')?.textContent).toBe(
      'あ · aerrors 10% · 10 attempts',
    );
    expect(container.querySelector('[data-testid="heat-legend"]')?.textContent).toContain(
      'more errors',
    );
  });
});
