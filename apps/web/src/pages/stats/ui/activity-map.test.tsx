// @vitest-environment happy-dom
import { describe, it, expect, afterEach } from 'vitest';
import { render } from 'preact';
import { act } from 'preact/test-utils';
import { loadDictionaryPart } from '@/shared/i18n';
import { dayStart, localDay } from '@/entities/learn';
import type { ActivityDay } from '../lib/activity';
import { ActivityMap } from './activity-map';

// The route brings the strings of the screen; here the test does.
await loadDictionaryPart('stats');

let container: HTMLDivElement;

afterEach(() => {
  render(null, container);
  container.remove();
});

// A Wednesday, so the last column is not full.
const TODAY = localDay(new Date(2026, 5, 17, 12).getTime());

function mount(days: Map<number, ActivityDay>, weeks = 12): void {
  container = document.createElement('div');
  document.body.appendChild(container);
  void act(() => {
    render(<ActivityMap days={days} today={TODAY} weeks={weeks} />, container);
  });
}

function cells(): HTMLButtonElement[] {
  return [...container.querySelectorAll<HTMLButtonElement>('[data-testid="activity-cell"]')];
}

function press(cell: HTMLElement | undefined, key: string): void {
  void act(() => {
    if (cell === undefined) return;
    cell.dispatchEvent(new KeyboardEvent('keydown', { key, bubbles: true, cancelable: true }));
  });
}

describe('ActivityMap', () => {
  it('draws the days up to today, the last cell is today', () => {
    mount(new Map());
    const all = cells();
    expect(all).toHaveLength(11 * 7 + 3);
    expect(all.at(-1)?.classList.contains('is-today')).toBe(true);
    expect(container.querySelectorAll('.is-today').length).toBe(2); // the cell and the legend
    expect(all[0]?.classList.contains('is-l0')).toBe(true);
  });

  it('takes the level class from the answers and the test mark from the tests', () => {
    mount(
      new Map([
        [TODAY - 1, { answers: 60, tests: 0, active: true }],
        [TODAY - 2, { answers: 0, tests: 2, active: false }],
        [TODAY - 3, { answers: 0, tests: 0, active: true }],
      ]),
    );
    const all = cells();
    const at = (back: number): HTMLElement | undefined => all[all.length - 1 - back];
    expect(at(1)?.classList.contains('is-l4')).toBe(true);
    expect(at(1)?.classList.contains('is-test')).toBe(false);
    expect(at(2)?.classList.contains('is-l0')).toBe(true);
    expect(at(2)?.classList.contains('is-test')).toBe(true);
    expect(at(3)?.classList.contains('is-l1')).toBe(true);
  });

  it('puts the numbers of a day in its label', () => {
    mount(
      new Map([
        [TODAY - 1, { answers: 51, tests: 3, active: true }],
        [TODAY - 2, { answers: 1, tests: 0, active: true }],
      ]),
    );
    const all = cells();
    expect(all.at(-1)?.getAttribute('aria-label')).toContain('no activity');
    expect(all.at(-1)?.getAttribute('aria-label')).toContain('today');
    expect(all.at(-2)?.getAttribute('aria-label')).toContain('51 answers · 3 tests');
    expect(all.at(-3)?.getAttribute('aria-label')).toContain('1 answer');
    expect(all.at(-2)?.getAttribute('aria-label')).toContain(
      new Intl.DateTimeFormat('en', { day: 'numeric', month: 'short' }).format(dayStart(TODAY - 1)),
    );
  });

  it('has one Tab stop, on today', () => {
    mount(new Map());
    const stops = cells().filter((cell) => cell.tabIndex === 0);
    expect(stops).toHaveLength(1);
    expect(stops[0]).toBe(cells().at(-1));
  });

  it('moves by a week and by a day, and stops at the edges', () => {
    mount(new Map());
    const all = cells();
    const last = all.length - 1;
    press(all[last], 'ArrowLeft');
    expect(all[last - 7]?.tabIndex).toBe(0);
    expect(document.activeElement).toBe(all[last - 7]);
    press(all[last - 7], 'ArrowUp');
    expect(all[last - 8]?.tabIndex).toBe(0);
    press(all[last - 8], 'Home');
    expect(all[0]?.tabIndex).toBe(0);
    press(all[0], 'ArrowLeft');
    expect(all[0]?.tabIndex).toBe(0);
    press(all[0], 'End');
    expect(all[last]?.tabIndex).toBe(0);
    press(all[last], 'ArrowRight');
    press(all[last], 'ArrowDown');
    expect(all[last]?.tabIndex).toBe(0);
  });

  it('shows the tooltip of the focused cell', () => {
    mount(new Map([[TODAY - 1, { answers: 12, tests: 0, active: true }]]));
    const all = cells();
    expect(container.querySelector('[role="tooltip"]')).toBeNull();
    void act(() => {
      all.at(-2)?.focus();
    });
    expect(container.querySelector('[role="tooltip"]')?.textContent).toContain('12 answers');
  });

  it('shifts the tooltip at the first and the last columns, not in the middle', () => {
    mount(new Map());
    const all = cells();
    const tip = (): Element | null => container.querySelector('[data-testid="activity-tip"]');
    const focusCell = (cell: HTMLElement | undefined): void => {
      void act(() => {
        cell?.focus();
      });
    };
    focusCell(all[0]);
    expect(tip()?.classList.contains('is-start')).toBe(true);
    expect(tip()?.classList.contains('is-end')).toBe(false);
    expect(tip()?.classList.contains('text-ui-caption')).toBe(true);
    focusCell(all.at(-1));
    expect(tip()?.classList.contains('is-end')).toBe(true);
    expect(tip()?.classList.contains('is-start')).toBe(false);
    focusCell(all[6 * 7]);
    expect(tip()?.classList.contains('is-start')).toBe(false);
    expect(tip()?.classList.contains('is-end')).toBe(false);
  });
});
