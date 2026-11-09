// @vitest-environment happy-dom
import { describe, it, expect, afterEach } from 'vitest';
import { render } from 'preact';
import { act } from 'preact/test-utils';
import { KanaChart, KanaChartPanel } from './kana-chart';
import type { ChartCell, ChartCellState, ChartRow } from './kana-chart';

const cell = (kana: string, state: ChartCellState = 'learning', due = false): ChartCell => ({
  id: `t:${kana}`,
  kana,
  state,
  due,
  lines: [kana, state],
  label: `${kana}, ${state}${due ? ', due' : ''}`,
});

const rows: ChartRow[] = [
  {
    id: 'v',
    head: '',
    label: 'vowels',
    block: 'basic',
    cells: [cell('あ', 'mastered', true), cell('い'), cell('う', 'locked')],
  },
  {
    id: 'y',
    head: 'y',
    label: 'Ya',
    block: 'basic',
    cells: [cell('や', 'confident'), null, cell('よ', 'locked')],
  },
  {
    id: 'g',
    head: 'g',
    label: 'Ga',
    block: 'dakuten',
    cells: [cell('が', 'locked'), cell('ぎ', 'locked'), cell('ぐ', 'locked')],
  },
];

let container: HTMLDivElement;

function mount(node: Parameters<typeof render>[0]): HTMLDivElement {
  container = document.createElement('div');
  document.body.append(container);
  render(node, container);
  return container;
}

afterEach(() => {
  render(null, container);
  container.remove();
});

const cells = (root: HTMLElement): HTMLButtonElement[] =>
  Array.from(root.querySelectorAll<HTMLButtonElement>('[data-testid="kana-cell"]'));
const byKana = (root: HTMLElement, kana: string): HTMLButtonElement => {
  const found = cells(root).find((el) => el.dataset['kana'] === kana);
  if (found === undefined) throw new Error(`no cell ${kana}`);
  return found;
};
const press = (el: HTMLElement, key: string): Promise<void> =>
  act(() => {
    el.dispatchEvent(new KeyboardEvent('keydown', { key, bubbles: true, cancelable: true }));
  });

describe('KanaChart', () => {
  it('is a grid whose cells name their state and due mark, with one tab stop', () => {
    const root = mount(<KanaChart rows={rows} ariaLabel="Kana table" />);
    expect(root.querySelector('[role="grid"]')?.getAttribute('aria-label')).toBe('Kana table');
    expect(byKana(root, 'あ').getAttribute('aria-label')).toBe('あ, mastered, due');
    expect(byKana(root, 'あ').dataset['due']).toBe('true');
    expect(byKana(root, 'う').getAttribute('aria-disabled')).toBe('true');
    expect(cells(root).filter((el) => el.tabIndex === 0)).toHaveLength(1);
    expect(root.querySelector('[role="rowheader"]')?.getAttribute('aria-label')).toBe('vowels');
  });

  it('moves with the arrows, across gaps and blocks, and the tab stop follows', async () => {
    const root = mount(<KanaChart rows={rows} ariaLabel="x" />);
    byKana(root, 'あ').focus();
    await press(byKana(root, 'あ'), 'ArrowRight');
    expect(document.activeElement).toBe(byKana(root, 'い'));
    await press(byKana(root, 'い'), 'ArrowDown');
    expect(document.activeElement).toBe(byKana(root, 'や'));
    await press(byKana(root, 'や'), 'ArrowRight');
    expect(document.activeElement).toBe(byKana(root, 'よ'));
    await press(byKana(root, 'よ'), 'ArrowDown');
    expect(document.activeElement).toBe(byKana(root, 'ぐ'));
    expect(byKana(root, 'ぐ').tabIndex).toBe(0);
    expect(byKana(root, 'あ').tabIndex).toBe(-1);
  });

  it('shows one tooltip at a time, on focus and hover', async () => {
    const root = mount(<KanaChart rows={rows} ariaLabel="x" />);
    expect(root.querySelector('[data-testid="kana-tooltip"]')).toBeNull();
    await act(() => {
      byKana(root, 'あ').focus();
    });
    expect(root.querySelectorAll('[data-testid="kana-tooltip"]')).toHaveLength(1);
    await act(() => {
      byKana(root, 'い').dispatchEvent(new MouseEvent('mouseover', { bubbles: true }));
      byKana(root, 'い').dispatchEvent(new MouseEvent('mouseenter'));
    });
    const tips = root.querySelectorAll('[data-testid="kana-tooltip"]');
    expect(tips).toHaveLength(1);
    expect(tips[0]?.textContent).toBe('いlearning');
  });

  it('opens the details of an unlocked cell under its row, and Esc returns the focus', async () => {
    const root = mount(
      <KanaChart rows={rows} ariaLabel="x" renderDetails={(c) => <span>details {c.kana}</span>} />,
    );
    const a = byKana(root, 'い');
    a.focus();
    await act(() => {
      a.click();
    });
    expect(a.getAttribute('aria-expanded')).toBe('true');
    expect(root.querySelector('[data-testid="kana-details"]')?.textContent).toBe('details い');
    byKana(root, 'う').focus();
    await press(byKana(root, 'う'), 'Escape');
    expect(root.querySelector('[data-testid="kana-details"]')).toBeNull();
    expect(document.activeElement).toBe(a);
    // A locked cell does not open.
    await act(() => {
      byKana(root, 'う').click();
    });
    expect(root.querySelector('[data-testid="kana-details"]')).toBeNull();
    expect(byKana(root, 'う').hasAttribute('aria-expanded')).toBe(false);
  });

  it('groups the rows of each block under its caption, the blocks side by side', () => {
    const root = mount(
      <KanaChart rows={rows} ariaLabel="x" blockLabels={{ basic: 'basic', dakuten: 'voiced' }} />,
    );
    const groups = Array.from(root.querySelectorAll('[role="rowgroup"]'));
    expect(groups.map((group) => group.getAttribute('aria-label'))).toEqual(['basic', 'voiced']);
    expect(groups[0]?.querySelectorAll('[role="row"]')).toHaveLength(2);
    expect(groups[1]?.querySelectorAll('[role="row"]')).toHaveLength(1);
    expect(root.querySelector('.nk-chart__grid')?.children).toHaveLength(2);
  });

  it('draws the legend: the four states, then the due mark', () => {
    const labels = {
      locked: 'locked',
      learning: 'learning',
      confident: 'confident',
      mastered: 'mastered',
      due: 'review due',
    };
    const root = mount(<KanaChart rows={rows} ariaLabel="x" legend={{ sample: 'あ', labels }} />);
    const legend = root.querySelector('[data-testid="kana-legend"]');
    expect(legend?.textContent).toBe('あlockedあlearningあconfidentあmasteredあreview due');
    expect(legend?.querySelector('.is-due')).not.toBeNull();
  });

  it('shows no tooltip on a cell whose details are open, and Esc in the details closes them', async () => {
    const root = mount(
      <KanaChart
        rows={rows}
        ariaLabel="x"
        renderDetails={(c, close) => (
          <KanaChartPanel
            kana={c.kana}
            romaji="i"
            lines={[{ text: 'learning' }, { text: 'median', dim: true }]}
            closeLabel="close"
            onClose={close}
          />
        )}
      />,
    );
    const i = byKana(root, 'い');
    await act(() => {
      i.focus();
    });
    expect(root.querySelectorAll('[data-testid="kana-tooltip"]')).toHaveLength(1);
    await act(() => {
      i.click();
    });
    expect(root.querySelector('[data-testid="kana-tooltip"]')).toBeNull();
    const panel = root.querySelector('[data-testid="kana-panel"]');
    expect(panel?.textContent).toBe('いicloselearningmedian');
    const close = Array.from(panel?.querySelectorAll('button') ?? []).find(
      (button) => button.textContent === 'close',
    );
    if (close === undefined) throw new Error('no close button');
    close.focus();
    await press(close, 'Escape');
    expect(root.querySelector('[data-testid="kana-panel"]')).toBeNull();
    expect(document.activeElement).toBe(i);
  });
});
