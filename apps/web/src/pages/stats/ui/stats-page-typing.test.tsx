// @vitest-environment happy-dom
import { describe, it, expect, afterEach, vi } from 'vitest';
import { render } from 'preact';
import { act } from 'preact/test-utils';
import type { TestResult } from '@nekotype/shared/types';
import { getDatabase } from '@/shared/lib';
import { t, loadDictionaryPart } from '@/shared/i18n';
import { dayStart, localDay } from '@/entities/learn';
import type * as statsModule from '@/entities/stats';
import { StatsPage } from './stats-page';

// A failed read is simulated per test; otherwise the real store answers.
const failing = { on: false };
vi.mock('@/entities/stats', async (importOriginal) => {
  const original = await importOriginal<typeof statsModule>();
  return {
    ...original,
    readResults: (offset: number, limit: number) =>
      failing.on ? Promise.reject(new Error('read failed')) : original.readResults(offset, limit),
  };
});

// The route brings the strings of the screen; here the test does.
await loadDictionaryPart('stats');

// A file of its own: the typing store is read once per page load, so the records are seeded before
// the page first renders.

const settle = (): Promise<void> => new Promise((resolve) => setTimeout(resolve, 10));

// The page reads the stores, then the section reads the results: several turns of the event loop.
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

const DAY = localDay(Date.now());
const noon = (daysBack: number): number => dayStart(DAY - daysBack) + 12 * 3_600_000;

// r01: phrases, 20 days back; r02..r11: words (kpm 62..71), today; r12: a words repeat, today.
const SEED: TestResult[] = Array.from({ length: 12 }, (_, i) =>
  result(i + 1, {
    endedAt: i === 0 ? noon(20) : noon(0) + i * 60_000,
    ...(i === 0 ? { content: 'phrases', config: { kind: 'count', prompts: 25 } } : {}),
    ...(i === 11 ? { repeated: true } : {}),
  }),
);

const db = await getDatabase();
for (const item of SEED) await db.put('results', item.id, { ...item, synced: 0 });
await db.put('records', 'current', {
  'words|hiragana|learner|time:60': { best: { kpm: 71, resultId: 'r11' }, recent: [] },
  'phrases|hiragana|learner|count:25': { best: { kpm: 61, resultId: 'r01' }, recent: [] },
});
await db.put('delta', 'typing', {
  kanaStats: {},
  counters: { started: { typing: 14, learn: 0 }, finished: { typing: 12, learn: 0 } },
});

describe('stats page: typing section', () => {
  let container: HTMLDivElement;

  afterEach(() => {
    failing.on = false;
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
  const rows = (): string[][] =>
    Array.from(container.querySelectorAll('[data-testid="history-row"]')).map((row) =>
      Array.from(row.querySelectorAll('td'))
        .slice(1)
        .map((cell) => cell.textContent),
    );
  const mode = (): HTMLSelectElement | null =>
    container.querySelector('[data-testid="stats-filter-mode"]');
  const radio = (label: string): Element | undefined =>
    Array.from(container.querySelectorAll('[role="radio"]')).find((el) => el.textContent === label);
  const button = (label: string): Element | undefined =>
    Array.from(container.querySelectorAll('button')).find((el) => el.textContent === label);
  const click = (el: Element | undefined): Promise<void> =>
    act(() => {
      el?.dispatchEvent(new MouseEvent('click', { bubbles: true }));
    });

  it('opens on the mode of the latest test and 30 days, without repeats', async () => {
    await open();
    expect(mode()?.value).toBe('words|hiragana|learner|time:60');
    expect(Array.from(mode()?.options ?? []).map((o) => o.textContent)).toEqual([
      t('stats.filter.allModes'),
      'words · hiragana · relaxed · 60 s',
      'phrases · hiragana · relaxed · 25',
    ]);
    expect(radio(t('stats.filter.p30'))?.getAttribute('aria-checked')).toBe('true');

    // Ten tests (r02..r11); the repeat is out. Median of 62..71 is 66.5 → 67.
    expect(figuresText()).toBe(
      [
        `${t('stats.figure.tests')}10`,
        `${t('stats.figure.medianKpm')}67`,
        `${t('stats.figure.bestKpm')}71`,
        `${t('stats.figure.accuracy')}95%`,
      ].join(''),
    );
    const headings = Array.from(container.querySelectorAll('h2')).map((h) => h.textContent);
    expect(headings).toEqual([
      t('stats.typing.trend'),
      t('stats.typing.history'),
      t('stats.all.title'),
    ]);
    const chart = container.querySelector('[data-testid="stats-kpm-chart"]');
    expect(chart?.querySelector('polyline')?.getAttribute('points')?.split(' ')).toHaveLength(10);

    // Newest first; the current best of the key carries the badge; 10 rows, one page.
    expect(rows()).toHaveLength(10);
    expect(rows()[0]).toEqual([`words · 60 s${t('badge.personalBest')}`, '71', '95%', '60 s']);
    expect(container.querySelector(`nav[aria-label="${t('stats.history.pages')}"]`)).toBeNull();

    // All time: every personal best, whatever the filters.
    const bests = Array.from(container.querySelectorAll('[data-testid="stats-bests"] tr')).map(
      (item) => item.textContent,
    );
    expect(bests).toEqual([
      'phrases · hiragana · relaxed · 2561 kpm',
      'words · hiragana · relaxed · 60 s71 kpm',
    ]);
    expect(container.querySelector('[data-testid="stats-typing-tests"]')?.textContent).toBe(
      'typing tests: 14 started · 12 finished',
    );
  });

  it('"with repeats" adds the repeat; the history is paged in memory; a filter resets the page', async () => {
    await open();
    await click(button(t('stats.filter.repeats')));
    expect(figuresText()).toContain(`${t('stats.figure.tests')}11`);
    // The repeat is not in the KPM figures.
    expect(figuresText()).toContain(`${t('stats.figure.bestKpm')}71`);
    expect(rows()).toHaveLength(10);
    expect(rows()[0]).toEqual(['words · 60 s · repeat', '72', '95%', '60 s']);

    await click(button(t('stats.history.older')));
    expect(rows()).toEqual([['words · 60 s', '62', '95%', '60 s']]);

    await click(button(t('stats.filter.repeats')));
    expect(figuresText()).toContain(`${t('stats.figure.tests')}10`);
    expect(rows()).toHaveLength(10);
  });

  it('"all modes" has no KPM figures; 7 days drops the old phrases test', async () => {
    await open();
    const select = mode();
    await act(() => {
      if (select === null) return;
      select.value = 'all';
      select.dispatchEvent(new Event('change', { bubbles: true }));
    });
    expect(figuresText()).toContain(`${t('stats.figure.medianKpm')}–`);
    expect(figuresText()).toContain(`${t('stats.figure.bestKpm')}–`);
    // 30 days: the phrases test of 20 days back and ten words tests.
    expect(figuresText()).toContain(`${t('stats.figure.tests')}11`);

    await click(radio(t('stats.filter.p7')));
    expect(figuresText()).toContain(`${t('stats.figure.tests')}10`);
    await click(radio(t('stats.filter.all')));
    expect(figuresText()).toContain(`${t('stats.figure.tests')}11`);
  });

  it('an empty selection says so and "show all time" widens it; All time stays', async () => {
    await open();
    const select = mode();
    await act(() => {
      if (select === null) return;
      select.value = 'phrases|hiragana|learner|count:25';
      select.dispatchEvent(new Event('change', { bubbles: true }));
    });
    // The phrases test is 20 days old: 30 days has it, 7 days does not.
    expect(figuresText()).toContain(`${t('stats.figure.tests')}1`);
    await click(radio(t('stats.filter.p7')));
    expect(container.textContent).toContain(t('stats.typing.noSelection'));
    expect(container.querySelector('[data-testid="stats-figures"]')).toBeNull();
    expect(container.querySelector('[data-testid="stats-bests"]')).not.toBeNull();

    await click(button(t('stats.showAll')));
    expect(radio(t('stats.filter.all'))?.getAttribute('aria-checked')).toBe('true');
    expect(figuresText()).toContain(`${t('stats.figure.tests')}1`);
  });

  it('a failed read replaces the selection with an error and a retry; All time stays', async () => {
    failing.on = true;
    window.location.hash = '#typing';
    container = document.createElement('div');
    document.body.appendChild(container);
    render(<StatsPage />, container);
    await until(() => container.textContent.includes(t('stats.history.error')));
    expect(container.querySelector('[data-testid="stats-figures"]')).toBeNull();
    expect(container.querySelector('[data-testid="stats-bests"]')).not.toBeNull();

    failing.on = false;
    await click(button(t('route.retry')));
    await until(() => container.querySelector('[data-testid="stats-figures"]') !== null);
    expect(container.textContent).not.toContain(t('stats.history.error'));
  });
});
