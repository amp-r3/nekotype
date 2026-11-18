// @vitest-environment happy-dom
import { afterEach, describe, expect, it, vi } from 'vitest';
import { render } from 'preact';
import { act } from 'preact/test-utils';
import { loadDictionaryPart, t } from '@/shared/i18n';
import { resolveAnotherAccount } from '../model/runtime';
import { AnotherAccountDialog } from './another-account-dialog';

vi.mock('../model/runtime', () => ({ resolveAnotherAccount: vi.fn(() => Promise.resolve()) }));

await loadDictionaryPart('settings');

function button(root: ParentNode, label: string): HTMLButtonElement {
  const found = Array.from(root.querySelectorAll('button')).find((b) => b.textContent === label);
  if (!found) throw new Error(`no button "${label}"`);
  return found;
}

// Design decision 118.
describe('AnotherAccountDialog', () => {
  const container = document.createElement('div');
  document.body.appendChild(container);
  afterEach(() => {
    render(null, container);
    vi.mocked(resolveAnotherAccount).mockClear();
  });

  it('asks, with cancel focused first', async () => {
    await act(() => {
      render(<AnotherAccountDialog />, container);
    });
    const dialog = container.querySelector('dialog');
    expect(dialog?.open).toBe(true);
    expect(dialog?.textContent).toContain(t('account.other.title'));
    expect(dialog?.textContent).toContain(t('account.other.text'));
    expect(document.activeElement?.textContent).toBe(t('account.other.cancel'));
  });

  it.each([
    ['account.other.cancel', 'cancel'],
    ['account.other.discard', 'discard'],
  ] as const)('%s chooses %s once', async (label, choice) => {
    await act(() => {
      render(<AnotherAccountDialog />, container);
    });
    await act(() => {
      button(container, t(label)).click();
    });
    expect(resolveAnotherAccount).toHaveBeenCalledWith(choice);
    expect(button(container, t('account.other.cancel')).disabled).toBe(true);
    expect(button(container, t('account.other.discard')).disabled).toBe(true);
  });

  it('Esc (the dialog closes) cancels', async () => {
    await act(() => {
      render(<AnotherAccountDialog />, container);
    });
    await act(() => {
      container.querySelector('dialog')?.dispatchEvent(new Event('close'));
    });
    expect(resolveAnotherAccount).toHaveBeenCalledWith('cancel');
  });
});
