// @vitest-environment happy-dom
import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { render } from 'preact';
import { act } from 'preact/test-utils';
import { signal } from '@preact/signals';
import type { ReportRequest } from '@nekotype/shared/types';
import { CONTENT_VERSION } from '@/entities/prompt';
import type { PromptItem } from '@/entities/prompt';
import { loadDictionaryPart } from '@/shared/i18n';
import { ReportAction } from './ui/report-action';
import type { ReportOutcome } from './api/reports';
import type { TurnstileApi, TurnstileOptions } from './lib/turnstile';
import { siteKeyFor } from './lib/turnstile';

await loadDictionaryPart('type');
// The dialog is a lazy chunk; the first transform of it would outlast a short wait.
await import('./ui/report-dialog');

const settle = async (): Promise<void> => {
  await act(async () => {
    await new Promise((resolve) => setTimeout(resolve, 30));
  });
};

const word: PromptItem = { key: 'w:hiragana:ねこ', text: 'ねこ', meaning: { en: 'cat' } };
const phrase: PromptItem = {
  key: 'p:163818',
  text: 'あにはおーすとらりあにいます。',
  meaning: { en: 'My brother is now in Australia.' },
  tatoebaId: 163818,
};

// p5-plan.md D21 and the design decisions 114–117: the report dialog.
describe('report a problem', () => {
  const prompt = signal<PromptItem | null>(word);
  const hidden = signal(false);
  let container: HTMLDivElement;
  let options: TurnstileOptions | null;
  let loads: number;
  let removed: number;
  let resets: number;
  let sent: ReportRequest[];
  let outcome: ReportOutcome;
  let loadFails: boolean;
  let closed: number;
  let sendGate: Promise<void> | null;

  const api: TurnstileApi = {
    render: (_container, given) => {
      options = given;
      return 'widget-1';
    },
    reset: () => {
      resets += 1;
    },
    remove: () => {
      removed += 1;
    },
  };
  const load = (): Promise<TurnstileApi> => {
    loads += 1;
    return loadFails ? Promise.reject(new Error('offline script')) : Promise.resolve(api);
  };
  const send = async (request: ReportRequest): Promise<ReportOutcome> => {
    sent.push(request);
    if (sendGate !== null) await sendGate;
    return outcome;
  };
  const pass = async (token = 'tok'): Promise<void> => {
    await act(() => {
      options?.callback(token);
    });
  };
  const click = async (selector: string): Promise<void> => {
    const element = container.querySelector<HTMLElement>(selector);
    await act(() => {
      element?.click();
    });
    await settle();
  };
  const buttons = (): HTMLButtonElement[] => [
    ...document.querySelectorAll<HTMLButtonElement>('dialog button'),
  ];
  const buttonText = (text: string): HTMLButtonElement | undefined =>
    buttons().find((b) => b.textContent === text);

  beforeEach(async () => {
    // happy-dom has no showModal.
    HTMLDialogElement.prototype.showModal = function showModal(this: HTMLDialogElement) {
      this.setAttribute('open', '');
    };
    HTMLDialogElement.prototype.close = function close(this: HTMLDialogElement) {
      this.removeAttribute('open');
      this.dispatchEvent(new Event('close'));
    };
    prompt.value = word;
    hidden.value = false;
    options = null;
    loads = 0;
    removed = 0;
    resets = 0;
    sent = [];
    outcome = 'sent';
    loadFails = false;
    closed = 0;
    sendGate = null;
    vi.spyOn(navigator, 'onLine', 'get').mockReturnValue(true);
    container = document.createElement('div');
    document.body.appendChild(container);
    render(
      <ReportAction
        currentPrompt={prompt}
        hidden={hidden}
        onClosed={() => {
          closed += 1;
        }}
        dialogDeps={{ load, send }}
      />,
      container,
    );
    await settle();
  });

  afterEach(() => {
    vi.restoreAllMocks();
    render(null, container);
    container.remove();
  });

  it('does not touch the Turnstile script until the dialog opens', async () => {
    expect(loads).toBe(0);
    await click('[data-testid="report-action"]');
    expect(loads).toBe(1);
    expect(options?.sitekey).toBe('1x00000000000000000000AA');
    expect(options?.size).toBe('flexible');
  });

  it('is hidden with the signal and disabled offline', async () => {
    const action = container.querySelector<HTMLButtonElement>('[data-testid="report-action"]');
    hidden.value = true;
    await settle();
    expect(action?.hidden).toBe(true);
    hidden.value = false;
    vi.spyOn(navigator, 'onLine', 'get').mockReturnValue(false);
    await act(() => {
      window.dispatchEvent(new Event('offline'));
    });
    expect(action?.disabled).toBe(true);
    expect(action?.title).toBe('available online only');
  });

  it('sends the item id and the content version of the prompt on display, for a phrase too', async () => {
    prompt.value = phrase;
    await click('[data-testid="report-action"]');
    expect(document.querySelector('dialog h2')?.textContent).toBe(
      'Report a problem with this phrase',
    );
    expect(buttonText('send')?.disabled).toBe(true);
    await pass();
    expect(buttonText('send')?.disabled).toBe(false);
    await act(() => {
      buttonText('send')?.click();
    });
    await settle();
    expect(sent).toEqual([
      {
        itemId: 'p:163818',
        contentVersion: CONTENT_VERSION,
        reason: 'wrong_reading',
        turnstileToken: 'tok',
      },
    ]);
    expect(document.body.textContent).toContain('Report sent.');
    expect(buttonText('close')).toBeDefined();
  });

  it('titles a word and sends the reason and the trimmed comment', async () => {
    await click('[data-testid="report-action"]');
    expect(document.querySelector('dialog h2')?.textContent).toBe(
      'Report a problem with this word',
    );
    const select = document.querySelector<HTMLSelectElement>('[data-testid="report-reason"]');
    const comment = document.querySelector<HTMLTextAreaElement>('[data-testid="report-comment"]');
    await act(() => {
      if (select !== null) {
        select.value = 'wrong_translation';
        select.dispatchEvent(new Event('change', { bubbles: true }));
      }
      if (comment !== null) {
        comment.value = '  it is a dog  ';
        comment.dispatchEvent(new Event('input', { bubbles: true }));
      }
    });
    await pass();
    await act(() => {
      buttonText('send')?.click();
    });
    await settle();
    expect(sent[0]).toMatchObject({
      itemId: 'w:hiragana:ねこ',
      reason: 'wrong_translation',
      comment: 'it is a dog',
    });
  });

  it('cannot be closed while sending and says so', async () => {
    let release: () => void = () => undefined;
    sendGate = new Promise((resolve) => {
      release = resolve;
    });
    await click('[data-testid="report-action"]');
    await pass();
    await act(() => {
      buttonText('send')?.click();
    });
    expect(buttonText('sending…')?.disabled).toBe(true);
    expect(buttonText('cancel')?.disabled).toBe(true);
    expect(document.querySelector('dialog [aria-label="close"]')).toBeNull();
    release();
    await settle();
    expect(document.body.textContent).toContain('Report sent.');
  });

  it('after a failed check resets the widget and waits for a new token', async () => {
    outcome = 'turnstile';
    await click('[data-testid="report-action"]');
    await pass();
    await act(() => {
      buttonText('send')?.click();
    });
    await settle();
    expect(document.body.textContent).toContain('verification failed. try again.');
    expect(resets).toBe(1);
    expect(buttonText('send')?.disabled).toBe(true);
    await pass('second');
    outcome = 'sent';
    await act(() => {
      buttonText('send')?.click();
    });
    await settle();
    expect(sent.map((r) => r.turnstileToken)).toEqual(['tok', 'second']);
  });

  it('says that sending failed on any other answer', async () => {
    outcome = 'failed';
    await click('[data-testid="report-action"]');
    await pass();
    await act(() => {
      buttonText('send')?.click();
    });
    await settle();
    expect(document.body.textContent).toContain(
      'failed to send. check the connection and try again.',
    );
    expect(resets).toBe(1);
  });

  it('offers a retry when the script does not load', async () => {
    loadFails = true;
    await click('[data-testid="report-action"]');
    expect(document.body.textContent).toContain('verification did not load.');
    expect(buttonText('send')?.disabled).toBe(true);
    loadFails = false;
    await act(() => {
      buttonText('retry')?.click();
    });
    await settle();
    expect(loads).toBe(2);
    expect(document.body.textContent).not.toContain('verification did not load.');
  });

  it('removes the widget and gives the keyboard back when it closes', async () => {
    await click('[data-testid="report-action"]');
    await act(() => {
      buttonText('cancel')?.click();
    });
    await settle();
    expect(removed).toBeGreaterThan(0);
    expect(closed).toBe(1);
  });

  it('disables the fields and says so when the connection is gone', async () => {
    await click('[data-testid="report-action"]');
    vi.spyOn(navigator, 'onLine', 'get').mockReturnValue(false);
    await act(() => {
      window.dispatchEvent(new Event('offline'));
    });
    await settle();
    expect(document.body.textContent).toContain('offline. reporting is available online only.');
    expect(
      document.querySelector<HTMLSelectElement>('[data-testid="report-reason"]')?.disabled,
    ).toBe(true);
    expect(buttonText('send')?.disabled).toBe(true);
  });
});

describe('siteKeyFor', () => {
  it('chooses by host', () => {
    expect(siteKeyFor('nekotype.pages.dev')).toBe('0x4AAAAAAGIZ6j5k_9gy6m6Z');
    expect(siteKeyFor('p5-12-report.nekotype.pages.dev')).toBe('0x4AAAAAAGIaKDNtOwbAu8TP');
    expect(siteKeyFor('localhost')).toBe('1x00000000000000000000AA');
    expect(siteKeyFor('evilnekotype.pages.dev')).toBe('1x00000000000000000000AA');
  });
});
