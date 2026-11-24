// @vitest-environment happy-dom
import { describe, it, expect, vi, afterEach } from 'vitest';
import { render } from 'preact';
import { act } from 'preact/test-utils';
import { signal } from '@preact/signals';
import { t } from '@/shared/i18n';

// H12: the database is the in-memory fallback, so progress cannot be saved.
vi.mock('@/shared/lib', async (importOriginal) => {
  const original = await importOriginal<Record<string, unknown>>();
  return { ...original, databaseMode: signal('memory') };
});

const { LearnPage } = await import('./learn-page');

describe('learn page: storage unavailable (H12)', () => {
  let container: HTMLDivElement;
  afterEach(() => {
    render(null, container);
    container.remove();
  });

  it('says progress cannot be saved, and the home still works', async () => {
    container = document.createElement('div');
    document.body.appendChild(container);
    render(<LearnPage />, container);
    for (
      let i = 0;
      i < 100 && container.querySelector('[data-testid="home-reason"]') === null;
      i++
    ) {
      await act(() => new Promise((resolve) => setTimeout(resolve, 30)));
    }
    expect(container.textContent).toContain(t('learn.storage'));
    expect(container.querySelector('[data-testid="home-reason"]')).not.toBeNull();
  });
});
