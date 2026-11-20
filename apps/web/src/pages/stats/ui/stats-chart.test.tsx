// @vitest-environment happy-dom
import { describe, it, expect, afterEach, vi } from 'vitest';
import { render, type ComponentProps } from 'preact';
import { act } from 'preact/test-utils';
import { StatsChart } from './stats-chart';
import type { ChartRange } from '../lib/trend';

let container: HTMLDivElement;

afterEach(() => {
  render(null, container);
  container.remove();
  vi.unstubAllGlobals();
});

// Out of time order on purpose: the cursor walks them by `x`.
const bars: ChartRange[] = [
  { x: 200, lo: 900, hi: 1300, mid: 1100, tip: () => ['second', 'median 1100 ms'] },
  { x: 20, lo: 800, hi: 1200, mid: 1000, tip: () => ['first', 'median 1000 ms'] },
  { x: 300, lo: 1000, hi: 1200, mid: 1100, tip: () => ['third', 'median 1100 ms'] },
];

type Extra = Partial<ComponentProps<typeof StatsChart>>;

function mount(width: number, ranges: readonly ChartRange[] = bars, extra: Extra = {}): void {
  vi.stubGlobal(
    'ResizeObserver',
    class {
      constructor(
        private readonly callback: (entries: { contentRect: { width: number } }[]) => void,
      ) {}
      observe(): void {
        this.callback([{ contentRect: { width: width } }]);
      }
      disconnect(): void {}
      unobserve(): void {}
    },
  );
  container = document.createElement('div');
  document.body.appendChild(container);
  void act(() => {
    render(
      <StatsChart
        testId="chart"
        ranges={ranges}
        slots={4}
        xDomain={[0, 400]}
        xTicks={[{ x: 100, label: 'a' }]}
        yDomain={[500, 1500]}
        yTicks={[500, 1000, 1500]}
        label="answer time"
        {...extra}
      />,
      container,
    );
  });
}

const svg = (): SVGElement | null => container.querySelector('svg');
const tip = (): string[] =>
  Array.from(container.querySelectorAll('[data-testid="chart-tip"] span')).map(
    (span) => span.textContent,
  );
const press = (key: string): void => {
  void act(() => {
    svg()?.dispatchEvent(new KeyboardEvent('keydown', { key, bubbles: true, cancelable: true }));
  });
};

describe('StatsChart', () => {
  it('draws a bar and a median tick per range, and the ticks of the axis', () => {
    mount(600);
    expect(container.querySelectorAll('[data-testid="chart-range"]')).toHaveLength(3);
    expect(container.querySelectorAll('.nk-rc__range')).toHaveLength(3);
    const ticks = container.querySelectorAll('.nk-rc__mid');
    expect(ticks).toHaveLength(3);
    // Plot width 544 over 4 slots: bar 68 × 0.5 clamps to 8; the tick is 2 px wider each side.
    expect(container.querySelector('.nk-rc__range')?.getAttribute('width')).toBe('8');
    expect(ticks[0]?.getAttribute('width')).toBe('12');
    expect(container.querySelectorAll('[data-testid="axis-tick"]')).toHaveLength(3);
  });

  it('keeps a bar at least 2 px and at most 8 px wide', () => {
    mount(600, bars, { slots: 400 });
    expect(container.querySelector('.nk-rc__range')?.getAttribute('width')).toBe('2');
  });

  it('is one Tab stop with a label', () => {
    mount(600);
    expect(svg()?.getAttribute('tabindex') ?? svg()?.getAttribute('tabIndex')).toBe('0');
    expect(svg()?.getAttribute('role')).toBe('img');
    expect(svg()?.getAttribute('aria-label')).toBe('answer time');
  });

  it('draws nothing at width 0', () => {
    mount(0);
    expect(svg()).toBeNull();
  });

  it('builds the tooltip lines only for the bar under the cursor', () => {
    const calls: string[] = [];
    const lazy = bars.map((bar) => ({
      ...bar,
      tip: () => {
        calls.push(bar.tip()[0] ?? '');
        return bar.tip();
      },
    }));
    mount(600, lazy);
    expect(calls).toEqual([]);
    press('Home');
    expect(calls).toEqual(['first']);
  });

  it('walks the bars in time order with the arrows, Home and End; Esc clears', () => {
    mount(600);
    press('ArrowLeft');
    expect(tip()).toEqual(['third', 'median 1100 ms']);
    press('ArrowLeft');
    expect(tip()[0]).toBe('second');
    press('Home');
    expect(tip()[0]).toBe('first');
    press('ArrowLeft');
    expect(tip()[0]).toBe('first');
    press('ArrowRight');
    expect(tip()[0]).toBe('second');
    press('End');
    expect(tip()[0]).toBe('third');
    expect(container.querySelector('[role="status"]')).not.toBeNull();
    press('Escape');
    expect(tip()).toEqual([]);
  });

  it('starts from the first bar with →, and a blur clears the cursor', () => {
    mount(600);
    press('ArrowRight');
    expect(tip()[0]).toBe('first');
    void act(() => {
      svg()?.dispatchEvent(new FocusEvent('blur'));
    });
    expect(tip()).toEqual([]);
  });

  it('shifts the tooltip within 150 px of an edge', () => {
    mount(600);
    const tipEl = (): Element | null => container.querySelector('[data-testid="chart-tip"]');
    press('Home');
    expect(tipEl()?.classList.contains('is-start')).toBe(true);
    expect(tipEl()?.classList.contains('is-end')).toBe(false);
    expect(tipEl()?.classList.contains('text-ui-caption')).toBe(true);
    press('End');
    expect(tipEl()?.classList.contains('is-end')).toBe(true);
    expect(tipEl()?.classList.contains('is-start')).toBe(false);
    press('Home');
    press('ArrowRight');
    expect(tipEl()?.classList.contains('is-start')).toBe(false);
    expect(tipEl()?.classList.contains('is-end')).toBe(false);
  });

  it('draws the reference line with its label under the bars', () => {
    mount(600, bars, { reference: { value: 1000, label: 'target 1000 ms' } });
    const reference = container.querySelector('[data-testid="chart-reference"]');
    expect(reference?.textContent).toBe('target 1000 ms');
    const bar = container.querySelector('.nk-rc__range');
    expect(bar).not.toBeNull();
    // The bars follow the reference in the document: they are drawn over it.
    expect(
      (reference?.compareDocumentPosition(bar ?? container) ?? 0) &
        Node.DOCUMENT_POSITION_FOLLOWING,
    ).not.toBe(0);
  });
});
