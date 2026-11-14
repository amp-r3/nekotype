// @vitest-environment happy-dom
import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { render } from 'preact';
import { act } from 'preact/test-utils';
import type { TestResult } from '@nekotype/shared/types';
import { getDatabase } from '@/shared/lib';
import { t, loadDictionaryPart } from '@/shared/i18n';
import { dayStart, localDay } from '@/entities/learn';
import type * as statsModule from '@/entities/stats';
import { StatsPage } from './stats-page';

// The history read is real, fails or never ends, per test.
type ReadMode = 'real' | 'fail' | 'hold';
const read: { mode: ReadMode } = { mode: 'real' };
vi.mock('@/entities/stats', async (importOriginal) => {
  const original = await importOriginal<typeof statsModule>();
  return {
    ...original,
    readAllResults: () =>
      read.mode === 'fail'
        ? Promise.reject(new Error('read failed'))
        : read.mode === 'hold'
          ? new Promise<never>(() => undefined)
          : original.readAllResults(),
  };
});

await loadDictionaryPart('stats');

const settle = (): Promise<void> => new Promise((resolve) => setTimeout(resolve, 10));

async function until(done: () => boolean): Promise<void> {
  for (let turn = 0; turn < 100 && !done(); turn++) await act(settle);
}

function result(n: number, patch: Partial<TestResult> = {}): TestResult {
  return {
    id: `r${String(n).padStart(2, '0')}`,
    content: 'words',
    script: 'hiragana',
    strictness: 'learner',
    config: { kind: 'time', seconds: 60 },
    endReason: 'complete',
    repeated: false,
    startedAt: n * 100_000,
    endedAt: n * 100_000 + 60_000,
    durationMs: 60_000,
    tokens: 100,
    erroredTokens: 5,
    items: 20,
    keystrokes: 150,
    rejectedKeystrokes: 6,
    assisted: 0,
    kpm: 60 + n,
    kanaAccuracy: 0.95,
    celebratedPersonalBest: false,
    contentVersion: 'c',
    appVersion: 'a',
    ...patch,
  };
}

const WORDS = 'words|hiragana|learner|time:60';
const REPEATS = 'phrases|hiragana|learner|count:10';
const DAY = localDay(Date.now());
const noon = (daysBack: number): number => dayStart(DAY - daysBack) + 12 * 3_600_000;

// r01: phrases, 20 days back. r02: phrases repeat, 40 days back (the only test of its mode).
// r03..r07: five words tests, today.
const SEED: TestResult[] = [
  result(1, { endedAt: noon(20), content: 'phrases', config: { kind: 'count', prompts: 25 } }),
  result(2, {
    endedAt: noon(40),
    content: 'phrases',
    config: { kind: 'count', prompts: 10 },
    repeated: true,
  }),
  ...Array.from({ length: 5 }, (_, i) => result(i + 3, { endedAt: noon(0) + i * 60_000 })),
];

const db = await getDatabase();
for (const item of SEED) await db.put('results', item.id, { ...item, synced: 0 });
await db.put('delta', 'typing', {
  kanaStats: {},
  counters: { started: { typing: 7, learn: 0 }, finished: { typing: 7, learn: 0 } },
});

describe('stats page: what the filters select', () => {
  let container: HTMLDivElement;

  beforeEach(() => {
    vi.stubGlobal(
      'ResizeObserver',
      class {
        constructor(
          private readonly callback: (entries: { contentRect: { width: number } }[]) => void,
        ) {}
        observe(): void {
          this.callback([{ contentRect: { width: 600 } }]);
        }
        disconnect(): void {}
        unobserve(): void {}
      },
    );
  });

  afterEach(() => {
    vi.unstubAllGlobals();
    read.mode = 'real';
    render(null, container);
    container.remove();
    window.location.hash = '';
  });

  async function open(): Promise<void> {
    window.location.hash = '#typing';
    container = document.createElement('div');
    document.body.appendChild(container);
    render(<StatsPage />, container);
    await until(() => container.querySelector('[data-testid="stats-figures"]') !== null);
  }

  const figuresText = (): string | null | undefined =>
    container.querySelector('[data-testid="stats-figures"]')?.textContent;
  const radio = (label: string): Element | undefined =>
    Array.from(container.querySelectorAll('[role="radio"]')).find((el) => el.textContent === label);
  const button = (label: string): Element | undefined =>
    Array.from(container.querySelectorAll('button')).find((el) => el.textContent === label);
  const click = (el: Element | undefined): Promise<void> =>
    act(() => {
      el?.dispatchEvent(new MouseEvent('click', { bubbles: true }));
    });
  const choose = (value: string): Promise<void> =>
    act(() => {
      const select = container.querySelector<HTMLSelectElement>(
        '[data-testid="stats-filter-mode"]',
      );
      if (select === null) return;
      select.value = value;
      select.dispatchEvent(new Event('change', { bubbles: true }));
    });

  it('exactly five tests of one mode draw the line and the band, and the legend names both', async () => {
    await open();
    expect(container.querySelectorAll('[data-testid="chart-point"]')).toHaveLength(5);
    expect(container.querySelectorAll('[data-testid="chart-line"]')).toHaveLength(1);
    expect(container.querySelectorAll('[data-testid="chart-band"]')).toHaveLength(1);
    expect(container.textContent).toContain(t('stats.legend.median'));
    expect(container.textContent).toContain(t('stats.legend.band'));
    expect(container.querySelector('[data-testid="stats-few"]')).toBeNull();
  });

  it('"all modes" over a period that holds one mode behaves as that mode', async () => {
    await open();
    await choose('all');
    await click(radio(t('stats.filter.p7')));
    expect(figuresText()).toContain(`${t('stats.figure.medianKpm')}65`);
    expect(figuresText()).toContain(`${t('stats.figure.bestKpm')}67`);
    expect(container.querySelectorAll('[data-testid="chart-line"]')).toHaveLength(1);
    expect(container.querySelector('[data-testid="stats-mixed"]')).toBeNull();
  });

  it('"all modes" over two modes has no KPM figures and no line', async () => {
    await open();
    await choose('all');
    expect(figuresText()).toContain(`${t('stats.figure.medianKpm')}–`);
    expect(container.querySelector('[data-testid="stats-mixed"]')).not.toBeNull();
    expect(container.querySelector('[data-testid="chart-line"]')).toBeNull();
  });

  it('an empty selection offers "show all time" only while the period is not all', async () => {
    await open();
    await choose(REPEATS);
    expect(container.textContent).toContain(t('stats.typing.noSelection'));
    expect(button(t('stats.showAll'))).toBeDefined();
    await click(button(t('stats.showAll')));
    // The only test of this mode is a repeat and repeats are off: still empty, nothing to widen.
    expect(radio(t('stats.filter.all'))?.getAttribute('aria-checked')).toBe('true');
    expect(container.textContent).toContain(t('stats.typing.noSelection'));
    expect(button(t('stats.showAll'))).toBeUndefined();
  });

  it('an unread history shows the loading notice instead of the filters; All time is there', async () => {
    read.mode = 'hold';
    window.location.hash = '#typing';
    container = document.createElement('div');
    document.body.appendChild(container);
    render(<StatsPage />, container);
    await until(() => container.querySelector('[data-testid="stats-heat"]') !== null);
    expect(container.querySelector('[data-testid="stats-filter-mode"]')).toBeNull();
    expect(container.textContent).toContain(t('stats.history.loading'));
    expect(container.querySelector('[data-testid="stats-bests"]')).toBeNull();
    expect(container.querySelector('[data-testid="stats-heat"]')).not.toBeNull();
  });

  it('a retry after a failed read shows the loading notice, then the screen on the newest mode', async () => {
    read.mode = 'fail';
    window.location.hash = '#typing';
    container = document.createElement('div');
    document.body.appendChild(container);
    render(<StatsPage />, container);
    await until(() => container.textContent.includes(t('stats.history.error')));

    read.mode = 'hold';
    await click(button(t('route.retry')));
    await act(settle);
    expect(container.textContent).not.toContain(t('stats.history.error'));
    expect(container.textContent).toContain(t('stats.history.loading'));

    // The held read never ends; a fresh page reads for real.
    render(null, container);
    read.mode = 'real';
    render(<StatsPage />, container);
    await until(() => container.querySelector('[data-testid="stats-filter-mode"]') !== null);
    expect(
      container.querySelector<HTMLSelectElement>('[data-testid="stats-filter-mode"]')?.value,
    ).toBe(WORDS);
  });
});
