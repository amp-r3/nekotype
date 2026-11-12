// @vitest-environment happy-dom
import { describe, it, expect, afterEach, vi } from 'vitest';
import { render } from 'preact';
import { act } from 'preact/test-utils';
import { t, loadDictionaryPart } from '@/shared/i18n';
import type { PhraseCredit } from '@/entities/prompt';
import { AboutPage } from './about-page';

const loader = vi.hoisted(() => ({
  current: (): Promise<readonly unknown[]> => Promise.resolve([]),
}));

vi.mock('@/entities/prompt', () => ({ loadCredits: () => loader.current() }));

await loadDictionaryPart('about');

const settle = (): Promise<void> => new Promise((resolve) => setTimeout(resolve, 5));

function credit(id: number, transcriptionAuthor: string | null = 'tr'): PhraseCredit {
  return {
    id: `p:${String(id)}`,
    text: 'あ',
    sentence: { id, author: `s${String(id)}` },
    translation: { id: id + 1, author: 'tl' },
    transcriptionAuthor,
  };
}

// 60 credits, shuffled: the page sorts them by sentence id.
const all = Array.from({ length: 60 }, (_, i) => credit(i + 1, i === 0 ? null : 'tr')).reverse();

async function mount(load: () => Promise<readonly PhraseCredit[]>): Promise<HTMLElement> {
  loader.current = load;
  const container = document.createElement('div');
  document.body.append(container);
  await act(async () => {
    render(<AboutPage />, container);
    await settle();
  });
  return container;
}

describe('about page', () => {
  let container: HTMLElement | undefined;

  afterEach(() => {
    if (container !== undefined) {
      render(null, container);
      container.remove();
    }
  });

  it('lists 25 rows, sorted, with the machine mark and the count line', async () => {
    container = await mount(() => Promise.resolve(all));
    const rows = container.querySelectorAll('[data-testid="credit-row"]');
    expect(rows).toHaveLength(25);
    expect(rows[0]?.textContent).toContain('#1');
    expect(rows[0]?.textContent).toContain(t('about.credits.machine'));
    expect(rows[1]?.textContent).not.toContain(t('about.credits.machine'));
    const link = rows[0]?.querySelector('a');
    expect(link?.getAttribute('href')).toBe('https://tatoeba.org/sentences/1');
    expect(link?.getAttribute('aria-label')).toBe(t('about.credits.sentenceLink', { id: '1' }));
    expect(link?.getAttribute('rel')).toBe('noopener');
    expect(container.querySelector('[role="status"]')?.textContent).toBe(
      t('about.credits.count', { from: '1', to: '25', total: '60' }),
    );
  });

  it('pages forward and announces the range', async () => {
    container = await mount(() => Promise.resolve(all));
    const nav = container.querySelector(`nav[aria-label="${t('about.credits.pages')}"]`);
    const next = [...(nav?.querySelectorAll('button') ?? [])].find(
      (b) => b.textContent === t('about.credits.next'),
    );
    await act(async () => {
      next?.click();
      await settle();
    });
    expect(container.querySelector('[role="status"]')?.textContent).toBe(
      t('about.credits.count', { from: '26', to: '50', total: '60' }),
    );
    expect(container.querySelector('[data-testid="credit-row"]')?.textContent).toContain('#26');
  });

  it('keeps sections 1 and 2 while the list loads', async () => {
    container = await mount(() => new Promise(() => undefined));
    expect(container.textContent).toContain(t('about.sources.title'));
    expect(container.textContent).toContain('AGPL-3.0-only');
    expect(container.textContent).toContain(t('about.credits.loading'));
    expect(container.querySelector('[data-testid="credit-row"]')).toBeNull();
  });

  it('keeps sections 1 and 2 after a failure and retries', async () => {
    let calls = 0;
    container = await mount(() => {
      calls += 1;
      return calls === 1 ? Promise.reject(new Error('offline')) : Promise.resolve(all);
    });
    expect(container.textContent).toContain(t('about.sources.title'));
    expect(container.textContent).toContain(t('about.credits.error'));
    const retry = [...container.querySelectorAll('button')].find(
      (b) => b.textContent === t('about.credits.retry'),
    );
    await act(async () => {
      retry?.click();
      await settle();
    });
    expect(container.querySelectorAll('[data-testid="credit-row"]')).toHaveLength(25);
  });
});
