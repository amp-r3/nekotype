// @vitest-environment happy-dom
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { render } from 'preact';
import { act } from 'preact/test-utils';
import { loadDictionaryPart, setLocale, t } from '@/shared/i18n';
import type { TranslationKey } from '@/shared/i18n';
import { createMemoryDb } from '@/shared/lib';
import { initUser } from '@/entities/user';
import type * as UserModule from '@/entities/user';
import type * as SyncModule from '@/features/sync';
import { deleteAccount, prepareSignOut, signOut, syncOnline, syncStatus } from '@/features/sync';
import type { SyncStatus, Unsent } from '@/features/sync';
import { AccountPanel } from './account-panel';

// The chunk of the engine is not needed to show the panel: writable signals and spies stand in.
vi.mock('@/features/sync', async (original) => {
  const { signal } = await import('@preact/signals');
  return {
    syncStatus: signal('synced'),
    syncOnline: signal(true),
    prepareSignOut: vi.fn(),
    signOut: vi.fn(),
    deleteAccount: vi.fn(),
    readProfile: (await original<typeof SyncModule>()).readProfile,
  };
});

const beginSignIn = vi.hoisted(() => vi.fn());
vi.mock('@/entities/user', async (original) => ({
  ...(await original<typeof UserModule>()),
  beginSignIn,
}));

await loadDictionaryPart('settings');

const setStatus = (status: SyncStatus): void => {
  Reflect.set(syncStatus, 'value', status);
};
const setOnline = (online: boolean): void => {
  Reflect.set(syncOnline, 'value', online);
};
const settle = (): Promise<void> => new Promise((resolve) => setTimeout(resolve, 0));

type MetaUser = {
  expired?: boolean;
  profile?: unknown;
};

async function signIn({
  expired = false,
  profile = { displayName: 'shiro', email: 'shiro@example.com', provider: 'github' },
}: MetaUser = {}): Promise<void> {
  const db = createMemoryDb();
  await db.put('meta', 'userId', 'user-1');
  await db.put('meta', 'profile', profile);
  if (expired) await db.put('meta', 'sessionExpired', true);
  await initUser(db, 'nekotype.pages.dev');
}

function button(root: HTMLElement, label: string): HTMLButtonElement {
  const found = Array.from(root.querySelectorAll('button')).find((el) => el.textContent === label);
  if (!found) throw new Error(`no button "${label}"`);
  return found;
}

describe('AccountPanel', () => {
  const container = document.createElement('div');
  document.body.appendChild(container);
  const show = async (): Promise<void> => {
    await act(() => {
      render(<AccountPanel />, container);
    });
  };
  beforeEach(async () => {
    setStatus('synced');
    setOnline(true);
    vi.mocked(prepareSignOut).mockReset();
    vi.mocked(signOut).mockReset();
    vi.mocked(deleteAccount).mockReset();
    beginSignIn.mockReset();
    await signIn();
  });
  afterEach(async () => {
    render(null, container);
    await setLocale('en');
  });

  it.each<[SyncStatus, TranslationKey]>([
    ['synced', 'settings.sync.synced'],
    ['pending', 'settings.sync.pending'],
    ['offline', 'settings.sync.offline'],
    ['expired', 'settings.sync.expired'],
    ['blocked', 'settings.sync.blocked'],
  ])('shows the %s status', async (status, key) => {
    setStatus(status);
    await show();
    expect(container.textContent).toContain(t(key));
    expect(container.textContent).toContain(t('settings.account.title'));
  });

  it('follows the status while it is shown', async () => {
    setStatus('pending');
    await show();
    await act(() => {
      setStatus('synced');
    });
    expect(container.textContent).toContain(t('settings.sync.synced'));
  });

  it('shows the profile: the name and the provider', async () => {
    await show();
    expect(container.querySelector('[data-testid="account-name"]')?.textContent).toBe('shiro');
    expect(container.textContent).toContain(t('settings.account.viaGithub'));
    expect(container.querySelector('[data-testid="cat-mark"]')).not.toBeNull();
    expect(container.querySelector('img')).toBeNull();
  });

  it('names the account by its email without a display name, and "account" without both', async () => {
    await signIn({ profile: { displayName: null, email: 'a@example.com', provider: 'google' } });
    await show();
    expect(container.querySelector('[data-testid="account-name"]')?.textContent).toBe(
      'a@example.com',
    );
    expect(container.textContent).toContain(t('settings.account.viaGoogle'));

    await signIn({ profile: { displayName: null, email: null, provider: 'google' } });
    await show();
    expect(container.querySelector('[data-testid="account-name"]')?.textContent).toBe(
      t('settings.account.noName'),
    );
  });

  it('offers sign in again with the same provider while the session is expired', async () => {
    await signIn({ expired: true });
    setStatus('expired');
    await show();
    await act(() => {
      button(container, t('settings.account.signInAgain')).click();
    });
    expect(beginSignIn).toHaveBeenCalledWith('github');
  });

  it('disables sign-out offline and says why', async () => {
    setOnline(false);
    setStatus('offline');
    await show();
    expect(button(container, t('settings.account.signOut')).disabled).toBe(true);
    expect(container.textContent).toContain(t('settings.account.needsConnection'));
  });

  it('lets an expired session sign out offline: the server has no session left', async () => {
    await signIn({ expired: true });
    setOnline(false);
    setStatus('expired');
    await show();
    expect(button(container, t('settings.account.signOut')).disabled).toBe(false);
    expect(container.textContent).not.toContain(t('settings.account.needsConnection'));
  });

  it('signs out without a dialog when nothing is unsent', async () => {
    vi.mocked(prepareSignOut).mockResolvedValue({ results: 0, other: false });
    vi.mocked(signOut).mockResolvedValue(true);
    await show();
    await act(async () => {
      button(container, t('settings.account.signOut')).click();
      await settle();
    });
    expect(signOut).toHaveBeenCalledTimes(1);
    expect(container.querySelector('dialog[open]')).toBeNull();
  });

  it.each<[Unsent, string, string]>([
    [{ results: 3, other: true }, '3 results have not been sent yet.', '3 результата ещё не'],
    [{ results: 1, other: false }, '1 result has not been sent yet.', '1 результат ещё не'],
    [{ results: 5, other: false }, '5 results have not been sent', '5 результатов ещё не'],
    [{ results: 0, other: true }, 'Some progress has not been sent yet.', 'Часть прогресса'],
  ])('asks first when data is unsent: %o', async (unsent, en, ru) => {
    vi.mocked(prepareSignOut).mockResolvedValue(unsent);
    vi.mocked(signOut).mockResolvedValue(true);
    await show();
    await act(async () => {
      button(container, t('settings.account.signOut')).click();
      await settle();
    });
    const dialog = container.querySelector('dialog');
    if (dialog === null) throw new Error('no dialog');
    expect(dialog.open).toBe(true);
    expect(dialog.textContent).toContain(en);
    expect(signOut).not.toHaveBeenCalled();

    await act(async () => {
      await setLocale('ru');
      await loadDictionaryPart('settings');
    });
    expect(dialog.textContent).toContain(ru);
  });

  it('keeps everything when the dialog is cancelled, and signs out when confirmed', async () => {
    vi.mocked(prepareSignOut).mockResolvedValue({ results: 2, other: false });
    vi.mocked(signOut).mockResolvedValue(true);
    await show();
    const open = async (): Promise<HTMLDialogElement> => {
      await act(async () => {
        button(container, t('settings.account.signOut')).click();
        await settle();
      });
      const dialog = container.querySelector('dialog');
      if (dialog === null) throw new Error('no dialog');
      return dialog;
    };

    let dialog = await open();
    await act(() => {
      button(dialog, t('signOut.cancel')).click();
    });
    expect(dialog.open).toBe(false);
    expect(signOut).not.toHaveBeenCalled();

    dialog = await open();
    await act(async () => {
      button(dialog, t('signOut.action')).click();
      await settle();
    });
    expect(signOut).toHaveBeenCalledTimes(1);
  });

  it('enables sign-out again when the server could not be reached', async () => {
    vi.mocked(prepareSignOut).mockResolvedValue({ results: 0, other: false });
    vi.mocked(signOut).mockResolvedValue(false);
    await show();
    await act(async () => {
      button(container, t('settings.account.signOut')).click();
      await settle();
    });
    expect(button(container, t('settings.account.signOut')).disabled).toBe(false);
  });
  describe('delete account', () => {
    const deleteDialog = (): HTMLDialogElement => {
      const found = Array.from(container.querySelectorAll('dialog')).find((el) =>
        el.textContent.includes(t('delete.title')),
      );
      if (found === undefined) throw new Error('no delete dialog');
      return found;
    };
    const type = async (dialog: HTMLElement, value: string): Promise<void> => {
      const field = dialog.querySelector('input');
      if (field === null) throw new Error('no field');
      await act(() => {
        field.value = value;
        field.dispatchEvent(new Event('input', { bubbles: true }));
      });
    };
    const openDialog = async (): Promise<HTMLDialogElement> => {
      await show();
      await act(() => {
        button(container, t('settings.account.delete')).click();
      });
      return deleteDialog();
    };

    it('disables the button offline and with an expired session, and says why', async () => {
      setOnline(false);
      setStatus('offline');
      await show();
      expect(button(container, t('settings.account.delete')).disabled).toBe(true);
      expect(container.textContent).toContain(t('settings.account.needsConnection'));

      await signIn({ expired: true });
      setOnline(false);
      setStatus('expired');
      await show();
      expect(button(container, t('settings.account.delete')).disabled).toBe(true);
      expect(container.textContent).toContain(t('settings.account.signInToDelete'));
      expect(container.textContent).not.toContain(t('settings.account.needsConnection'));
    });

    it('keeps the action disabled until the word is typed', async () => {
      const dialog = await openDialog();
      const action = button(dialog, t('delete.action'));
      expect(dialog.open).toBe(true);
      expect(action.disabled).toBe(true);

      await type(dialog, 'delet');
      expect(action.disabled).toBe(true);
      await type(dialog, ' Delete ');
      expect(action.disabled).toBe(false);
      expect(deleteAccount).not.toHaveBeenCalled();
    });

    it('asks for the word of the current language', async () => {
      await setLocale('ru');
      await loadDictionaryPart('settings');
      const dialog = await openDialog();
      await type(dialog, 'delete');
      expect(button(dialog, t('delete.action')).disabled).toBe(true);
      await type(dialog, 'удалить');
      expect(button(dialog, t('delete.action')).disabled).toBe(false);
    });

    it('cancels without a request', async () => {
      const dialog = await openDialog();
      await type(dialog, 'delete');
      await act(() => {
        button(dialog, t('delete.cancel')).click();
      });
      expect(dialog.open).toBe(false);
      expect(deleteAccount).not.toHaveBeenCalled();
    });

    it('cannot be closed while the request runs and shows the progress', async () => {
      let finish: (done: boolean) => void = () => {};
      vi.mocked(deleteAccount).mockReturnValue(
        new Promise<boolean>((resolve) => {
          finish = resolve;
        }),
      );
      const dialog = await openDialog();
      await type(dialog, 'delete');
      await act(() => {
        button(dialog, t('delete.action')).click();
      });

      expect(button(dialog, t('delete.busy')).disabled).toBe(true);
      expect(button(dialog, t('delete.cancel')).disabled).toBe(true);
      expect(dialog.querySelector('input')?.disabled).toBe(true);
      expect(dialog.querySelector(`[aria-label="${t('signOut.cancel')}"]`)).toBeNull();
      const escape = new Event('cancel', { cancelable: true });
      dialog.dispatchEvent(escape);
      expect(escape.defaultPrevented).toBe(true);

      await act(async () => {
        finish(true);
        await settle();
      });
    });

    it('shows the failure, keeps the word and lets the user try again', async () => {
      vi.mocked(deleteAccount).mockResolvedValueOnce(false).mockResolvedValueOnce(true);
      const dialog = await openDialog();
      await type(dialog, 'delete');
      await act(async () => {
        button(dialog, t('delete.action')).click();
        await settle();
      });

      expect(dialog.open).toBe(true);
      expect(dialog.textContent).toContain(t('delete.failed'));
      expect(dialog.querySelector('input')?.value).toBe('delete');
      const again = button(dialog, t('delete.action'));
      expect(again.disabled).toBe(false);

      await act(async () => {
        again.click();
        await settle();
      });
      expect(deleteAccount).toHaveBeenCalledTimes(2);
      expect(dialog.open).toBe(false);
    });
  });
});
