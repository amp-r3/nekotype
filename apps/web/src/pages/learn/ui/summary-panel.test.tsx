// @vitest-environment happy-dom
import { describe, it, expect, afterEach, vi } from 'vitest';
import { render } from 'preact';
import type { LearnKanaKey } from '@nekotype/shared/types';
import type { ForecastState, ShownForecast } from '@/entities/learn';
import { loadDictionaryPart, setLocale } from '@/shared/i18n';
import type { ForecastChange, SessionSummary } from '../lib/summary';
import { key } from '../lib/test-util';
import { SummaryPanel } from './summary-panel';

// The panel's strings are a part of the dictionary that the lazy panel brings with it.
await loadDictionaryPart('home');

const shown = (over: Partial<ShownForecast> = {}): ShownForecast => ({
  row: 'hiragana:m',
  low: 1,
  median: 2,
  high: 4,
  raw: 2,
  basis: 'corrected',
  ...over,
});
const ready = (over: Partial<ShownForecast> = {}): ForecastState => ({
  kind: 'ready',
  forecast: shown(over),
});

const empty: SessionSummary = {
  introduced: [],
  learned: [],
  faster: [],
  slower: [],
  mixups: [],
  errors: [],
  states: new Map(),
};

let container: HTMLDivElement;

function mount(
  change: ForecastChange,
  summary: SessionSummary = empty,
  onOpen = vi.fn<(opened: LearnKanaKey) => void>(),
) {
  container = document.createElement('div');
  document.body.appendChild(container);
  render(
    <SummaryPanel summary={summary} change={change} track="hiragana" onOpen={onOpen} />,
    container,
  );
  return onOpen;
}

afterEach(async () => {
  render(null, container);
  container.remove();
  await setLocale('en');
});

const forecast = (): HTMLElement | null =>
  container.querySelector<HTMLElement>('[data-testid="summary-forecast"]');
const lines = (): string => forecast()?.textContent ?? '';

describe('summary: the forecast change (decision 148)', () => {
  it('shows the medians before and after, as `3 → 2 sessions`, with the words for a screen reader', () => {
    mount({ before: shown({ median: 3 }), after: ready({ median: 2 }) });
    expect(lines()).toBe('the whole m row opens in about3 → 2 sessions');
    expect(container.querySelector('[data-testid="summary-forecast-value"]')?.textContent).toBe(
      '3 → 2 sessions',
    );
    expect(container.querySelector('[role="group"]')?.getAttribute('aria-label')).toBe(
      'before the session: 3, now: 2 sessions',
    );
  });

  it('shows no change in colour or words when the forecast grew', () => {
    mount({ before: shown({ median: 2 }), after: ready({ median: 3 }) });
    expect(container.querySelector('[data-testid="summary-forecast-value"]')?.textContent).toBe(
      '2 → 3 sessions',
    );
    expect(container.querySelector('.text-miss')).toBeNull();
  });

  it('uses the singular for one session', () => {
    mount({ before: shown({ median: 2 }), after: ready({ median: 1 }) });
    expect(container.querySelector('[data-testid="summary-forecast-value"]')?.textContent).toBe(
      '2 → 1 session',
    );
  });

  it('names the vowels without a row head', () => {
    mount({ before: null, after: ready({ row: 'hiragana:vowels', median: 3 }) });
    expect(lines()).toBe('all the vowels open in about3 sessions');
  });

  it('shows only the number after when there was no forecast before', () => {
    mount({ before: null, after: ready({ median: 3 }) });
    expect(container.querySelector('[data-testid="summary-forecast-value"]')?.textContent).toBe(
      '3 sessions',
    );
    expect(container.querySelector('[role="group"]')).toBeNull();
  });

  it('says the row is open when the session opened it, then the next row', () => {
    mount({
      before: shown({ row: 'hiragana:m', median: 1 }),
      after: ready({ row: 'hiragana:y', median: 3 }),
    });
    expect(container.querySelector('[data-testid="summary-forecast-opened"]')?.textContent).toBe(
      'the m row is fully open',
    );
    expect(container.querySelector('[data-testid="summary-forecast-value"]')?.textContent).toBe(
      '3 sessions',
    );
  });

  it('says the vowels are open after a first session that opened them', () => {
    mount({
      before: shown({ row: 'hiragana:vowels', median: 1 }),
      after: ready({ row: 'hiragana:k', median: 3 }),
    });
    expect(container.querySelector('[data-testid="summary-forecast-opened"]')?.textContent).toBe(
      'the vowels are fully open',
    );
  });

  it('says the row is open and the track complete when every kana is introduced', () => {
    mount({ before: shown({ row: 'hiragana:vowels' }), after: { kind: 'complete' } });
    expect(lines()).toBe('the vowels are fully openevery hiragana is open');
  });

  it('says there is no forecast for a row beyond the horizon', () => {
    mount({ before: null, after: { kind: 'beyond', row: 'hiragana:m' } });
    expect(lines()).toBe('no forecast for the m row yet');
  });

  it('keeps its height while the insights compute, with no text', () => {
    mount({ before: shown(), after: { kind: 'pending' } });
    const place = container.querySelector('[data-state="pending"]');
    expect(place?.textContent).toBe('');
    expect(place?.getAttribute('aria-busy')).toBe('true');
    expect(place?.className).toContain('min-h-');
  });

  it('reads in Russian with the plural of the sessions', async () => {
    await setLocale('ru');
    mount({ before: shown({ median: 5 }), after: ready({ median: 2 }) });
    expect(lines()).toBe('весь ряд m откроется примерно через5 → 2 сессии');
    expect(container.querySelector('[role="group"]')?.getAttribute('aria-label')).toBe(
      'до сессии: 5, теперь: 2 сессии',
    );
  });
});

describe('summary: the kana', () => {
  const summary: SessionSummary = {
    ...empty,
    introduced: [key('あ'), key('い')],
    learned: [key('う')],
    faster: [{ key: key('え'), from: 1700, to: 1300 }],
    mixups: [{ key: key('ぬ'), chosen: key('め') }],
    errors: [key('ね')],
    states: new Map([
      [key('あ'), 'learning'],
      [key('い'), 'learning'],
      [key('う'), 'learned'],
    ]),
  };

  it('draws new and learned as cells with the state each kana has now', () => {
    mount({ before: null, after: { kind: 'pending' } }, summary);
    const cells = Array.from(
      container.querySelectorAll<HTMLElement>('[data-testid="summary-cell"]'),
    );
    expect(cells.map((cell) => [cell.dataset['kana'], cell.dataset['state']])).toEqual([
      ['あ', 'learning'],
      ['い', 'learning'],
      ['う', 'learned'],
    ]);
    expect(cells[0]?.getAttribute('aria-haspopup')).toBe('dialog');
    expect(cells[0]?.getAttribute('aria-label')).toBe('あ, a, learning: details');
  });

  it('opens the details of every listed kana from a button', () => {
    const onOpen = mount({ before: null, after: { kind: 'pending' } }, summary);
    const buttons = Array.from(container.querySelectorAll<HTMLButtonElement>('button'));
    // new 2 + learned 1 + faster 1 + mixup 2 + typed with errors 1.
    expect(buttons).toHaveLength(7);
    for (const button of buttons) {
      expect(button.getAttribute('aria-haspopup')).toBe('dialog');
      button.click();
    }
    expect(onOpen.mock.calls.map(([opened]) => opened)).toEqual([
      key('あ'),
      key('い'),
      key('う'),
      key('え'),
      key('ぬ'),
      key('め'),
      key('ね'),
    ]);
  });

  it('names the sections new and learned, and leaves an empty one out', () => {
    mount({ before: null, after: { kind: 'pending' } }, { ...summary, learned: [], faster: [] });
    expect(container.querySelector('[data-testid="summary-introduced"] h2')?.textContent).toBe(
      'new',
    );
    expect(container.querySelector('[data-testid="summary-learned"]')).toBeNull();
    expect(container.querySelector('[data-testid="summary-faster"]')).toBeNull();
  });

  it('says there are no changes when every section is empty', () => {
    mount({ before: null, after: { kind: 'pending' } });
    expect(container.textContent).toContain('no changes in this session. your answers are saved.');
  });
});
