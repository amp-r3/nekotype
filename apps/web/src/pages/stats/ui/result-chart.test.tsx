// @vitest-environment happy-dom
import { describe, it, expect, afterEach } from 'vitest';
import { render } from 'preact';
import { act } from 'preact/test-utils';
import { ResultChart } from './result-chart';

let container: HTMLDivElement;

afterEach(() => {
  render(null, container);
  container.remove();
});

const labels = ['1 Nov', '2 Nov', '3 Nov', '4 Nov', '5 Nov'];

function mount(values: (number | null)[], dots = false): HTMLElement {
  container = document.createElement('div');
  document.body.appendChild(container);
  render(
    <ResultChart
      testId="chart"
      values={values}
      xLabels={labels.slice(0, values.length)}
      domain={[1000, 2000]}
      ticks={[1000, 1500, 2000]}
      reference={{ value: 1500, label: 'target 1500 ms' }}
      tip={(index, value) => `${labels[index] ?? ''} · ${value === null ? 'no answers' : value}`}
      label="daily median"
      dots={dots}
    />,
    container,
  );
  return container;
}

describe('ResultChart', () => {
  it('draws a run of days as one line and a gap ends it', () => {
    const root = mount([1100, 1200, null, 1300, 1250], true);
    expect(root.querySelectorAll('polyline')).toHaveLength(2);
    expect(root.querySelectorAll('[data-testid="chart-dot"]')).toHaveLength(4);
  });

  // Design ResultChart: `dots` marks every point; otherwise only an isolated point is marked.
  it('without `dots` marks only the isolated points', () => {
    const root = mount([1100, 1200, 1250, null, 1300]);
    expect(root.querySelectorAll('polyline')).toHaveLength(1);
    expect(root.querySelectorAll('[data-testid="chart-dot"]')).toHaveLength(1);
  });

  it('marks an isolated point with a dot only', () => {
    const root = mount([1100, null, 1300]);
    expect(root.querySelectorAll('polyline')).toHaveLength(0);
    expect(root.querySelectorAll('[data-testid="chart-dot"]')).toHaveLength(2);
  });

  it('writes the SVG attributes the browser reads, in kebab-case', () => {
    const root = mount([1100, 1200, 1300]);
    const line = root.querySelector('polyline');
    expect(line?.getAttribute('stroke-width')).toBe('2');
    expect(line?.getAttribute('stroke-linecap')).toBe('round');
    expect(
      root.querySelector('[data-testid="chart-reference"] line')?.getAttribute('stroke-dasharray'),
    ).toBe('4 4');
    expect(
      root.querySelector('[data-testid="chart-reference"] text')?.getAttribute('text-anchor'),
    ).toBe('end');
    // No attribute the browser ignores.
    expect(root.innerHTML).not.toMatch(/strokeWidth|strokeDasharray|textAnchor|strokeLinecap/);
  });

  it('labels the axis with the ticks, and the first, middle and last point', () => {
    const root = mount([1100, 1200, 1300, 1250, 1400]);
    expect(
      Array.from(root.querySelectorAll('[data-testid="axis-tick"]')).map((el) => el.textContent),
    ).toEqual(['1000', '1500', '2000']);
    const text = root.querySelector('svg')?.textContent ?? '';
    expect(text).toContain('1 Nov');
    expect(text).toContain('3 Nov');
    expect(text).toContain('5 Nov');
    expect(text).not.toContain('2 Nov');
  });

  it('moves a cursor with the arrows and names the day in its tooltip', async () => {
    const root = mount([1100, null, 1300]);
    const svg = root.querySelector('svg');
    if (svg === null) throw new Error('no svg');
    const press = (key: string): Promise<void> =>
      act(() => {
        svg.dispatchEvent(new KeyboardEvent('keydown', { key, bubbles: true, cancelable: true }));
      });
    expect(root.querySelector('[data-testid="chart-tip"]')).toBeNull();
    await press('ArrowRight');
    expect(root.querySelector('[data-testid="chart-tip"]')?.textContent).toBe('1 Nov · 1100');
    await press('ArrowRight');
    expect(root.querySelector('[data-testid="chart-tip"]')?.textContent).toBe('2 Nov · no answers');
    await press('ArrowRight');
    await press('ArrowRight');
    expect(root.querySelector('[data-testid="chart-tip"]')?.textContent).toBe('3 Nov · 1300');
    await press('ArrowLeft');
    await press('ArrowLeft');
    await press('ArrowLeft');
    expect(root.querySelector('[data-testid="chart-tip"]')?.textContent).toBe('1 Nov · 1100');
  });
});
