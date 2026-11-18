// @vitest-environment happy-dom
import { afterEach, describe, expect, it, vi } from 'vitest';
import { render } from 'preact';
import { act } from 'preact/test-utils';
import { loadDictionaryPart, t } from '@/shared/i18n';
import type { TranslationKey } from '@/shared/i18n';
import { syncStatus } from '@/features/sync';
import type { SyncStatus } from '@/features/sync';
import { AccountPanel } from './account-panel';

// The chunk of the engine is not needed to show its status: a writable signal stands in for it.
vi.mock('@/features/sync', async () => {
  const { signal } = await import('@preact/signals');
  return { syncStatus: signal('synced') };
});

await loadDictionaryPart('settings');

const setStatus = (status: SyncStatus): void => {
  Reflect.set(syncStatus, 'value', status);
};

describe('AccountPanel', () => {
  const container = document.createElement('div');
  document.body.appendChild(container);
  afterEach(() => {
    render(null, container);
  });

  it.each<[SyncStatus, TranslationKey]>([
    ['synced', 'settings.sync.synced'],
    ['pending', 'settings.sync.pending'],
    ['offline', 'settings.sync.offline'],
    ['expired', 'settings.sync.expired'],
    ['blocked', 'settings.sync.blocked'],
  ])('shows the %s status', async (status, key) => {
    setStatus(status);
    await act(() => {
      render(<AccountPanel />, container);
    });
    expect(container.textContent).toContain(t(key));
    expect(container.textContent).toContain(t('settings.account.title'));
  });

  it('follows the status while it is shown', async () => {
    setStatus('pending');
    await act(() => {
      render(<AccountPanel />, container);
    });
    await act(() => {
      setStatus('synced');
    });
    expect(container.textContent).toContain(t('settings.sync.synced'));
  });
});
