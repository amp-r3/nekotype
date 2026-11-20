// @vitest-environment happy-dom
import { describe, it, expect, afterEach } from 'vitest';
import { render } from 'preact';
import { act } from 'preact/test-utils';
import { t, loadDictionaryPart } from '@/shared/i18n';
import { AboutPage } from './about-page';

await loadDictionaryPart('about');

describe('about page', () => {
  const container = document.createElement('div');

  afterEach(() => {
    render(null, container);
    container.remove();
  });

  it('shows the Nekotype section and no sources, credits or lazy content', async () => {
    document.body.append(container);
    await act(() => {
      render(<AboutPage />, container);
    });
    const headings = [...container.querySelectorAll('h2')].map((h) => h.textContent);
    expect(headings).toEqual([t('about.terms.title')]);
    expect(container.textContent).toContain('AGPL-3.0-only');
    expect(container.textContent).toContain('OFL-1.1');
    expect(container.querySelector('nav')).toBeNull();
    expect(container.querySelector('[data-testid="credit-row"]')).toBeNull();
  });
});
