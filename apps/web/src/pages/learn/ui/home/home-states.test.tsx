// @vitest-environment happy-dom
import { describe, it, expect, afterEach, vi } from 'vitest';
import { render } from 'preact';
import { act } from 'preact/test-utils';
import type { Outline, Reason, Stronger } from '@nekotype/model';
import { loadDictionaryPart, setLocale } from '@/shared/i18n';
import { keysOfTrack } from '@/entities/learn';
import type { ForecastState, StrongerState } from '@/entities/learn';
import { viewOfEvents, intro, learnedEvents, key } from '../../lib/test-util';
import { HomeAction } from './home-action';
import type { HomeActionProps } from './home-action';
import { HomeForecast } from './panels/home-forecast';
import { HomePath } from './panels/home-path';
import { HomeSince, groupOf } from './panels/home-since';

// The panels' strings are a part of the dictionary that the lazy panels bring with them.
await loadDictionaryPart('home');

const NOW = new Date(2026, 10, 24, 10, 0, 0).getTime();
const DAY = 86_400_000;

let container: HTMLDivElement;

function mount(node: preact.VNode): void {
  container = document.createElement('div');
  document.body.appendChild(container);
  render(node, container);
}

afterEach(async () => {
  render(null, container);
  container.remove();
  await setLocale('en');
});

const ref = { current: null };
function action(over: Partial<HomeActionProps>): preact.VNode {
  return (
    <HomeAction
      reason={null}
      outline={null}
      track="hiragana"
      canStart={true}
      suggest={false}
      now={NOW}
      onStart={() => undefined}
      onSuggest={() => undefined}
      continueRef={ref}
      suggestRef={ref}
      {...over}
    />
  );
}
const text = (selector: string): string | undefined =>
  container.querySelector(selector)?.textContent ?? undefined;
const reasonText = (): string | undefined => text('[data-testid="home-reason"]');
const buttons = (): string[] =>
  Array.from(container.querySelectorAll('button')).map((b) => b.textContent);

describe('home: the reason of Continue (H1)', () => {
  it.each<[string, Reason, string]>([
    ['review one', { kind: 'review', due: 1 }, '1 kana is due for review'],
    ['review many', { kind: 'review', due: 5 }, '5 kana are due for review'],
    ['learning', { kind: 'learning', learning: 2 }, 'finish learning 2 kana'],
    ['the vowels', { kind: 'new', key: key('あ'), row: 'hiragana:vowels' }, 'next: the vowels'],
    ['a row', { kind: 'new', key: key('ま'), row: 'hiragana:m' }, 'next: the m row'],
    [
      'a row of the other track',
      { kind: 'new', key: 'katakana:ア', row: 'katakana:vowels' },
      'next: the vowels, katakana',
    ],
  ])('%s', (_name, reason, expected) => {
    mount(action({ reason }));
    expect(reasonText()).toBe(expected);
  });

  it('weak: the kana are listed in a Japanese span', () => {
    mount(action({ reason: { kind: 'weak', keys: [key('ぬ'), key('め')] } }));
    expect(reasonText()).toBe('practise 2 weak kana: ぬ め');
    const span = container.querySelector('[data-testid="home-reason"] [lang="ja"]');
    expect(span?.textContent).toBe('ぬ め');
  });

  it('reads in Russian with the right plural', async () => {
    await setLocale('ru');
    mount(action({ reason: { kind: 'review', due: 5 } }));
    expect(reasonText()).toBe('5 кан ждут повторения');
    render(action({ reason: { kind: 'review', due: 1 } }), container);
    expect(reasonText()).toBe('1 кана ждёт повторения');
    render(action({ reason: { kind: 'weak', keys: [key('ぬ')] } }), container);
    expect(reasonText()).toBe('потренировать 1 слабую кану: ぬ');
  });

  it('is not there while the store loads: Continue is disabled', () => {
    mount(action({ reason: null, canStart: false }));
    expect(container.querySelector('[data-testid="home-reason"]')).toBeNull();
    const continueButton = container.querySelector('button');
    expect(continueButton?.disabled).toBe(true);
  });

  it('Continue starts the session, and shows its key except on a phone', async () => {
    const onStart = vi.fn();
    mount(action({ reason: { kind: 'review', due: 2 }, onStart }));
    const button = container.querySelector('button');
    expect(button?.textContent).toBe('continueenter');
    expect(button?.querySelector('kbd')?.className).toContain('pointer-coarse:hidden');
    await act(() => button?.click());
    expect(onStart).toHaveBeenCalledOnce();
  });
});

describe('home: the insights pending (H3)', () => {
  it('has the reason and a working Continue while the outline, the forecast and what got stronger are not there', async () => {
    const onStart = vi.fn();
    mount(
      <>
        {action({ reason: { kind: 'review', due: 2 }, outline: null, onStart })}
        <HomeForecast state={{ kind: 'pending' }} track="hiragana" />
        <HomeSince state={{ kind: 'pending' }} onOpen={() => undefined} />
      </>,
    );
    expect(reasonText()).toBe('2 kana are due for review');
    expect(container.querySelector('[data-testid="home-outline"]')).toBeNull();
    expect(container.querySelector('[data-testid="home-forecast"]')).toBeNull();
    expect(container.querySelector('[data-testid="home-stronger"]')).toBeNull();
    const button = container.querySelector('button');
    expect(button?.disabled).toBe(false);
    await act(() => button?.click());
    expect(onStart).toHaveBeenCalledOnce();
  });
});

describe('home: the outline (D7)', () => {
  const show = (outline: Outline): string | undefined => {
    mount(action({ reason: { kind: 'review', due: 2 }, outline }));
    return text('[data-testid="home-outline"]');
  };

  it('lists reviews and new kana, and counts learning in the total only', () => {
    expect(show({ reviews: 6, learning: 22, introductions: 2 })).toBe(
      'about 30 tasks: 6 reviews, 2 new kana',
    );
  });

  it('leaves out a part at 0', () => {
    expect(show({ reviews: 0, learning: 20, introductions: 5 })).toBe('about 25 tasks: 5 new kana');
  });

  it('has no colon with only learning kana, and singular forms', () => {
    expect(show({ reviews: 0, learning: 30, introductions: 0 })).toBe('about 30 tasks');
  });

  it('sets the numbers apart in the mono face', () => {
    show({ reviews: 6, learning: 22, introductions: 2 });
    const numbers = Array.from(
      container.querySelectorAll('[data-testid="home-outline"] .font-mono'),
    ).map((el) => el.textContent);
    expect(numbers).toEqual(['30', '6', '2']);
  });

  it('is not shown until the insights have it', () => {
    mount(action({ reason: { kind: 'review', due: 2 }, outline: null }));
    expect(container.querySelector('[data-testid="home-outline"]')).toBeNull();
  });
});

describe('home: nothing to do (H7)', () => {
  const none = (nextAt: number): Reason => ({ kind: 'none', nextAt });

  it('has no Continue, and names when the next review comes', () => {
    mount(action({ reason: none(NOW + 8 * 3600_000), canStart: false }));
    expect(reasonText()).toBe('nothing to review now');
    expect(container.querySelector('[data-testid="home-next-review"]')?.textContent).toMatch(
      /^next review: at \d{1,2}:\d{2}/,
    );
    expect(buttons()).toEqual([]);
    expect(container.querySelector('[data-testid="home-outline"]')).toBeNull();
  });

  it('shows the sleeping cat over the reason, and only then', () => {
    mount(action({ reason: none(NOW + 8 * 3600_000), canStart: false }));
    const cat = container.querySelector('svg');
    expect(cat?.getAttribute('aria-hidden')).toBe('true');
    expect(cat?.nextElementSibling).toBe(container.querySelector('[data-testid="home-reason"]'));
    render(action({ reason: { kind: 'review', due: 3 } }), container);
    expect(container.querySelector('svg')).toBeNull();
  });

  it('says "tomorrow at …" and a date later', () => {
    mount(action({ reason: none(NOW + DAY), canStart: false }));
    expect(text('[data-testid="home-next-review"]')).toMatch(/^next review: tomorrow at /);
    render(action({ reason: none(NOW + 5 * DAY), canStart: false }), container);
    expect(text('[data-testid="home-next-review"]')).toMatch(/^next review: \w+ \w+, /);
  });

  it('with the suggestion, `start katakana` is the primary action, after the reason', () => {
    const onSuggest = vi.fn();
    mount(action({ reason: none(NOW + 1000), canStart: false, suggest: true, onSuggest }));
    expect(buttons()).toEqual(['start katakana']);
    const button = container.querySelector('button');
    expect(button?.className).toContain('bg-fur');
    const order = Array.from(container.querySelectorAll('[data-testid]')).map((el) =>
      el.getAttribute('data-testid'),
    );
    expect(order.indexOf('home-reason')).toBeLessThan(order.indexOf('home-suggest'));
    button?.click();
    expect(onSuggest).toHaveBeenCalledOnce();
  });
});

describe('home: the katakana suggestion (H8)', () => {
  it('sits over the reason as a secondary button, and Continue stays', () => {
    mount(
      action({ reason: { kind: 'new', key: key('あ'), row: 'hiragana:vowels' }, suggest: true }),
    );
    expect(container.querySelector('[data-testid="home-suggest"]')?.textContent).toBe(
      'The basic hiragana are learned. You can start katakana.start katakana',
    );
    const order = Array.from(container.querySelectorAll('[data-testid]')).map((el) =>
      el.getAttribute('data-testid'),
    );
    expect(order.indexOf('home-suggest')).toBeLessThan(order.indexOf('home-reason'));
    expect(buttons()).toEqual(['start katakana', 'continueenter']);
  });

  it('is absent without the flag', () => {
    mount(action({ reason: { kind: 'review', due: 1 }, suggest: false }));
    expect(container.querySelector('[data-testid="home-suggest"]')).toBeNull();
  });
});

describe('home: the forecast (H3, H4, H5, H6, H11)', () => {
  const forecast = (
    over: Partial<{
      low: number;
      high: number;
      basis: 'model' | 'habits' | 'corrected';
      row: `hiragana:${string}`;
    }>,
  ): ForecastState => ({
    kind: 'ready',
    forecast: {
      row: over.row ?? 'hiragana:m',
      low: over.low ?? 2,
      median: 3,
      high: over.high ?? 4,
      raw: 3,
      basis: over.basis ?? 'corrected',
    },
  });
  const show = (
    state: ForecastState,
    track: 'hiragana' | 'katakana' = 'hiragana',
  ): string | undefined => {
    mount(<HomeForecast state={state} track={track} />);
    return text('[data-testid="home-forecast"]');
  };

  it('a range names the row', () => {
    expect(show(forecast({}))).toBe('the whole m row opens in 2–4 sessions');
  });

  it('the vowels have their own wording', () => {
    expect(show(forecast({ row: 'hiragana:vowels' }))).toBe('all the vowels open in 2–4 sessions');
  });

  it('low = high is one number with "about"', () => {
    expect(show(forecast({ low: 3, high: 3 }))).toBe('the whole m row opens in about 3 sessions');
    render(<HomeForecast state={forecast({ low: 1, high: 1 })} track="hiragana" />, container);
    expect(text('[data-testid="home-forecast"]')).toBe('the whole m row opens in about 1 session');
  });

  it('the model and the learner’s habits add the rough-estimate caption, a corrected one does not', () => {
    expect(show(forecast({ basis: 'model' }))).toContain('A rough estimate for now.');
    render(<HomeForecast state={forecast({ basis: 'habits' })} track="hiragana" />, container);
    expect(text('[data-testid="home-forecast"]')).toContain('It gets more precise as you answer.');
    render(<HomeForecast state={forecast({ basis: 'corrected' })} track="hiragana" />, container);
    expect(text('[data-testid="home-forecast"]')).not.toContain('rough');
  });

  it('beyond: no forecast for the row yet', () => {
    expect(show({ kind: 'beyond', row: 'hiragana:sh' })).toBe('no forecast for the sh row yet');
    render(
      <HomeForecast state={{ kind: 'beyond', row: 'hiragana:vowels' }} track="hiragana" />,
      container,
    );
    expect(text('[data-testid="home-forecast"]')).toBe('no forecast for the vowels yet');
  });

  it('complete: every kana of the track is open', () => {
    expect(show({ kind: 'complete' })).toBe('every hiragana is open');
    render(<HomeForecast state={{ kind: 'complete' }} track="katakana" />, container);
    expect(text('[data-testid="home-forecast"]')).toBe('every katakana is open');
  });

  it('pending has no test id (the probe waits for the forecast itself) and holds its height', () => {
    mount(<HomeForecast state={{ kind: 'pending' }} track="hiragana" />);
    expect(container.querySelector('[data-testid="home-forecast"]')).toBeNull();
    expect(container.querySelector('p')?.className).toContain('min-h-5');
  });

  it('reads in Russian: the plural follows the larger number', async () => {
    await setLocale('ru');
    expect(show(forecast({ low: 2, high: 4 }))).toBe('весь ряд m откроется через 2–4 сессии');
    render(<HomeForecast state={forecast({ low: 3, high: 8 })} track="hiragana" />, container);
    expect(text('[data-testid="home-forecast"]')).toBe('весь ряд m откроется через 3–8 сессий');
    render(<HomeForecast state={forecast({ low: 5, high: 5 })} track="hiragana" />, container);
    expect(text('[data-testid="home-forecast"]')).toBe(
      'весь ряд m откроется примерно через 5 сессий',
    );
    render(
      <HomeForecast
        state={forecast({ row: 'hiragana:vowels', low: 2, high: 4 })}
        track="hiragana"
      />,
      container,
    );
    expect(text('[data-testid="home-forecast"]')).toBe('все гласные откроются через 2–4 сессии');
  });
});

describe('home: the path (H6, H9)', () => {
  const NOW0 = 1_700_000_000_000;
  const vowels = ['あ', 'い', 'う', 'え', 'お'];

  it('opens the current block, marks the current row and counts its kana', () => {
    const view = viewOfEvents([
      ...vowels.map((kana, i) => intro(key(kana), { at: NOW0 + i })),
      ...learnedEvents('か', NOW0 + 1e6),
    ]);
    mount(<HomePath view={view} track="hiragana" />);
    const basic = container.querySelector('[data-testid="home-block-basic"]');
    expect(basic?.textContent).toContain('6/46');
    expect(basic?.getAttribute('aria-checked')).toBe('true');
    const rows = Array.from(container.querySelectorAll('#home-path-basic > li'));
    expect(rows[0]?.getAttribute('data-state')).toBe('done');
    expect(rows[1]?.getAttribute('data-state')).toBe('current');
    expect(rows[1]?.getAttribute('aria-current')).toBe('step');
    expect(rows[1]?.getAttribute('aria-label')).toBe('the k row: 1 of 5 open, you are here');
    expect(rows[1]?.textContent).toContain('1/5');
    // Only the current row says where the learner is.
    expect(container.querySelectorAll('[aria-current="step"]')).toHaveLength(1);
    expect(rows[2]?.getAttribute('data-state')).toBe('locked');
  });

  it('colours the kana: introduced dim, locked faint, the current row’s open kana bright', () => {
    const view = viewOfEvents([
      ...vowels.map((kana, i) => intro(key(kana), { at: NOW0 + i })),
      intro(key('か'), { at: NOW0 + 100 }),
    ]);
    mount(<HomePath view={view} track="hiragana" />);
    const colour = (kana: string): string =>
      Array.from(container.querySelectorAll('#home-path-basic [lang="ja"]')).find(
        (el) => el.textContent === kana,
      )?.className ?? '';
    expect(colour('あ')).toContain('text-fur-dim');
    expect(colour('か')).toMatch(/text-fur$/);
    expect(colour('き')).toContain('text-fur-faint');
  });

  it('shows all four blocks for katakana, with the vowels of the track', () => {
    mount(<HomePath view={viewOfEvents([])} track="katakana" />);
    expect(container.querySelectorAll('[data-testid^="home-block-"]')).toHaveLength(4);
    expect(container.querySelector('[data-testid="home-block-extended"]')).not.toBeNull();
  });

  it('a complete track has every block done and shows no current row', () => {
    const all = keysOfTrack('hiragana');
    const view = viewOfEvents(all.map((k, i) => intro(k, { at: NOW0 + i })));
    mount(<HomePath view={view} track="hiragana" />);
    expect(container.querySelectorAll('[aria-current="step"]')).toHaveLength(0);
    expect(
      container.querySelector('[data-testid="home-block-yoon"]')?.getAttribute('aria-checked'),
    ).toBe('true');
  });

  it('opens a block with Enter or a click, one at a time', async () => {
    mount(<HomePath view={viewOfEvents([])} track="hiragana" />);
    const dakuten = container.querySelector<HTMLElement>('[data-testid="home-block-dakuten"]');
    await act(() => dakuten?.click());
    expect(dakuten?.getAttribute('aria-checked')).toBe('true');
    expect(
      container.querySelector('[data-testid="home-block-basic"]')?.getAttribute('aria-checked'),
    ).toBe('false');
    // Only the open block lists its rows.
    expect(container.querySelector('#home-path-basic')).toBeNull();
    expect(container.querySelector('#home-path-dakuten')).not.toBeNull();
  });

  it('is a radiogroup of the blocks, each named by its count, with ← → between them', async () => {
    const view = viewOfEvents([
      ...vowels.map((kana, i) => intro(key(kana), { at: NOW0 + i })),
      intro(key('か'), { at: NOW0 + 100 }),
    ]);
    mount(<HomePath view={view} track="hiragana" />);
    const group = container.querySelector('[role="radiogroup"]');
    expect(group?.getAttribute('aria-label')).toBe('blocks of the path');
    const radios = Array.from(container.querySelectorAll<HTMLElement>('[role="radio"]'));
    expect(radios.map((r) => r.getAttribute('aria-label'))).toEqual([
      'basic: 6 of 46 kana open',
      'voiced: 0 of 25 kana open',
      'combinations: 0 of 33 kana open',
    ]);
    expect(radios.map((r) => r.getAttribute('aria-checked'))).toEqual(['true', 'false', 'false']);
    // The first kana of each block, then its name and count.
    expect(radios.map((r) => r.querySelector('[lang="ja"]')?.textContent)).toEqual([
      'あ',
      'が',
      'きゃ',
    ]);
    expect(radios[0]?.querySelector('[lang="ja"]')?.className).toContain('text-fur');
    expect(radios[1]?.querySelector('[lang="ja"]')?.className).toContain('text-fur-faint');
    await act(() => {
      radios[0]?.dispatchEvent(
        new KeyboardEvent('keydown', { key: 'ArrowRight', bubbles: true, cancelable: true }),
      );
    });
    const after = Array.from(container.querySelectorAll('[role="radio"]'));
    expect(after.map((r) => r.getAttribute('aria-checked'))).toEqual(['false', 'true', 'false']);
    expect(container.querySelector('#home-path-dakuten')).not.toBeNull();
  });

  it('names the blocks in Russian without a noun that would need a plural', async () => {
    await setLocale('ru');
    mount(<HomePath view={viewOfEvents([])} track="katakana" />);
    expect(
      Array.from(container.querySelectorAll('[role="radio"]')).map((r) =>
        r.getAttribute('aria-label'),
      ),
    ).toEqual([
      'основные: открыто 0 из 46',
      'звонкие: открыто 0 из 25',
      'сочетания: открыто 0 из 33',
      'расширенные: открыто 0 из 21',
    ]);
  });

  it('puts the caret before the first kana that is not introduced, in the current row only', () => {
    const view = viewOfEvents([
      ...vowels.map((kana, i) => intro(key(kana), { at: NOW0 + i })),
      intro(key('か'), { at: NOW0 + 100 }),
    ]);
    mount(<HomePath view={view} track="hiragana" />);
    const carets = container.querySelectorAll('.nk-home__caret');
    expect(carets).toHaveLength(1);
    expect(carets[0]?.getAttribute('aria-hidden')).toBe('true');
    expect(carets[0]?.parentElement?.textContent).toBe('き');
    expect(carets[0]?.closest('li')?.getAttribute('data-state')).toBe('current');
  });

  it('draws no caret on a complete track', () => {
    const view = viewOfEvents(keysOfTrack('hiragana').map((k, i) => intro(k, { at: NOW0 + i })));
    mount(<HomePath view={view} track="hiragana" />);
    expect(container.querySelectorAll('.nk-home__caret')).toHaveLength(0);
  });

  it('reads the here-label in Russian', async () => {
    await setLocale('ru');
    mount(<HomePath view={viewOfEvents([])} track="hiragana" />);
    expect(container.querySelector('[aria-current="step"]')?.getAttribute('aria-label')).toBe(
      'гласные: открыто 0 из 5, вы здесь',
    );
  });
});

describe('home: since the last session (H10)', () => {
  const item = (kana: string, from: Stronger['from'], to: Stronger['to']): Stronger => ({
    key: key(kana),
    from,
    to,
  });
  const ready = (kana: Stronger[]): StrongerState => ({ kind: 'ready', kana });

  it('puts each kana in one group: new, learned, mastered, stronger', () => {
    expect(groupOf(item('あ', 'locked', 'learning'))).toBe('new');
    expect(groupOf(item('あ', 'locked', 'learned'))).toBe('new');
    expect(groupOf(item('あ', 'learning', 'learned'))).toBe('learned');
    expect(groupOf(item('あ', 'learned', 'mastered'))).toBe('mastered');
    expect(groupOf(item('あ', 'learning', 'mastered'))).toBe('mastered');
    expect(groupOf(item('あ', 'learned', 'learned'))).toBe('stronger');
    expect(groupOf(item('あ', 'mastered', 'mastered'))).toBe('stronger');
  });

  it('lists the groups in order with the kana as cells in the state they have now', () => {
    mount(
      <HomeSince
        onOpen={() => undefined}
        state={ready([
          item('み', 'locked', 'learning'),
          item('ま', 'locked', 'learning'),
          item('ぬ', 'learning', 'learned'),
          item('き', 'learned', 'mastered'),
          item('か', 'learned', 'learned'),
        ])}
      />,
    );
    const groups = Array.from(container.querySelectorAll('[data-group]')).map((g) => [
      g.getAttribute('data-group'),
      Array.from(g.querySelectorAll('[data-testid="since-cell"]')).map((c) => c.textContent),
    ]);
    expect(groups).toEqual([
      ['new', ['み', 'ま']],
      ['learned', ['ぬ']],
      ['mastered', ['き']],
      ['stronger', ['か']],
    ]);
    const states = Array.from(container.querySelectorAll('[data-testid="since-cell"]')).map((c) =>
      c.getAttribute('data-state'),
    );
    expect(states).toEqual(['learning', 'learning', 'learned', 'mastered', 'learned']);
    expect(container.querySelector('.is-st-learned')).not.toBeNull();
    expect(container.querySelector('[data-testid="home-stronger"]')).not.toBeNull();
  });

  it('names a cell with the kana, the romaji and the state, and opens the details', async () => {
    const onOpen = vi.fn();
    mount(<HomeSince onOpen={onOpen} state={ready([item('し', 'locked', 'learning')])} />);
    const cell = container.querySelector<HTMLElement>('[data-testid="since-cell"]');
    expect(cell?.getAttribute('aria-label')).toBe('し, shi, learning: details');
    expect(cell?.getAttribute('lang')).toBe('ja');
    await act(() => cell?.click());
    expect(onOpen).toHaveBeenCalledWith(key('し'));
  });

  it('draws a kana of two characters in the small cell', () => {
    mount(
      <HomeSince
        onOpen={() => undefined}
        state={ready([{ key: 'hiragana:きゃ', from: 'locked', to: 'learning' }])}
      />,
    );
    expect(container.querySelector('[data-testid="since-cell"]')?.className).toContain(
      'text-jp-cell-sm',
    );
  });

  it('lists a long first session: every kana is a cell, in its group', () => {
    const many = Array.from('あいうえおかきくけこさしすせそ').map((k) =>
      item(k, 'locked', 'learning'),
    );
    mount(<HomeSince onOpen={() => undefined} state={ready(many)} />);
    expect(
      container.querySelectorAll('[data-group="new"] [data-testid="since-cell"]'),
    ).toHaveLength(15);
  });

  it('says so when nothing changed', () => {
    mount(<HomeSince onOpen={() => undefined} state={ready([])} />);
    expect(container.textContent).toContain('no changes since the last session');
    expect(container.querySelectorAll('[data-testid="since-cell"]')).toHaveLength(0);
  });

  it('keeps its place while pending, and is not shown on the first visit', () => {
    mount(<HomeSince onOpen={() => undefined} state={{ kind: 'pending' }} />);
    expect(container.querySelector('[data-testid="home-stronger"]')).toBeNull();
    expect(container.querySelector('section')?.getAttribute('aria-busy')).toBe('true');
    render(<HomeSince onOpen={() => undefined} state={{ kind: 'first' }} />, container);
    expect(container.querySelector('section')).toBeNull();
  });

  it('reads in Russian', async () => {
    await setLocale('ru');
    mount(<HomeSince onOpen={() => undefined} state={ready([item('し', 'locked', 'learning')])} />);
    expect(container.querySelector('h2')?.textContent).toBe('с прошлой сессии');
    expect(container.querySelector('h3')?.textContent).toBe('новые');
    expect(container.querySelector('[data-testid="since-cell"]')?.getAttribute('aria-label')).toBe(
      'し, shi, изучается: подробнее',
    );
  });
});
