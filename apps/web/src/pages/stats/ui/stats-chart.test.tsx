// @vitest-environment happy-dom
import { describe, it, expect, afterEach, vi } from 'vitest';
import { render } from 'preact';
import { act } from 'preact/test-utils';
import { StatsChart } from './stats-chart';
import type { ChartPoint } from '../lib/trend';

let container: HTMLDivElement;

afterEach(() => {
  render(null, container);
  container.remove();
  vi.unstubAllGlobals();
});

const points: ChartPoint[] = [
  { x: 200, y: 80, mark: null, tip: ['second', '80 kpm'] },
  { x: 20, y: 70, mark: 'hollow', tip: ['first', '70 kpm'] },
  { x: 300, y: 100, mark: 'best', tip: ['third', '100 kpm', 'personal best'] },
];

function mount(width: number, list: readonly ChartPoint[] = points): void {
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
        points={list}
        xDomain={[0, 400]}
        xTicks={[{ x: 100, label: 'a' }]}
        yDomain={[60, 120]}
        yTicks={[60, 90, 120]}
        label="speed"
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
  it('draws one circle per mark with the classes of best and hollow', () => {
    mount(600);
    const circles = Array.from(container.querySelectorAll('[data-testid="chart-point"]'));
    expect(circles).toHaveLength(3);
    expect(circles.map((c) => c.getAttribute('class'))).toEqual([
      'nk-rc__pt',
      'nk-rc__pt nk-rc__pt--hollow',
      'nk-rc__pt nk-rc__pt--best',
    ]);
    expect(circles.map((c) => c.getAttribute('r'))).toEqual(['3', '3', '4']);
    expect(container.querySelectorAll('[data-testid="axis-tick"]')).toHaveLength(3);
  });

  it('is one Tab stop with a label', () => {
    mount(600);
    expect(svg()?.getAttribute('tabindex') ?? svg()?.getAttribute('tabIndex')).toBe('0');
    expect(svg()?.getAttribute('role')).toBe('img');
    expect(svg()?.getAttribute('aria-label')).toBe('speed');
  });

  it('draws nothing at width 0', () => {
    mount(0);
    expect(svg()).toBeNull();
  });

  it('walks the marks in time order with the arrows, Home and End; Esc clears', () => {
    mount(600);
    press('ArrowLeft');
    expect(tip()).toEqual(['third', '100 kpm', 'personal best']);
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

  it('starts from the first mark with →, and a blur clears the cursor', () => {
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
    press('Home');
    const classes = (): string =>
      container.querySelector('[data-testid="chart-tip"]')?.className ?? '';
    expect(classes()).toContain('is-start');
    press('End');
    expect(classes()).toContain('is-end');
  });
});
