// @vitest-environment happy-dom
import { describe, it, expect, afterEach, vi } from 'vitest';
import { render, createRef } from 'preact';
import { act } from 'preact/test-utils';
import { signal } from '@preact/signals';
import type { Reason } from '@nekotype/model';
import { t } from '@/shared/i18n';
import type { ForecastChange, SessionSummary } from '../lib/summary';
import type { SummaryModel } from '../model/summary';
import { SummaryScreen } from './summary-screen';

// The panel is a chunk of its own; the actions under test do not depend on it.
const summary: SessionSummary = {
  introduced: [],
  learned: [],
  faster: [],
  slower: [],
  mixups: [],
  errors: [],
  states: new Map(),
};

function fakeModel(reason: Reason | null): SummaryModel {
  const change = signal<ForecastChange>({ before: null, after: { kind: 'pending' } });
  const current = signal(reason);
  return {
    change,
    reason: current,
    canStart: signal(reason !== null && reason.kind !== 'none'),
    dispose: () => undefined,
  };
}

describe('summary screen', () => {
  let container: HTMLDivElement;

  afterEach(() => {
    render(null, container);
    container.remove();
  });

  async function mount(reason: Reason | null = { kind: 'learning', learning: 2 }) {
    container = document.createElement('div');
    document.body.appendChild(container);
    const inputRef = createRef<HTMLInputElement>();
    const onContinue = vi.fn();
    const onHome = vi.fn();
    await act(() => {
      render(
        <>
          <input ref={inputRef} />
          <SummaryScreen
            summary={summary}
            model={fakeModel(reason)}
            track="hiragana"
            onContinue={onContinue}
            onHome={onHome}
            inputRef={inputRef}
          />
        </>,
        container,
      );
    });
    return { inputRef, onContinue, onHome };
  }

  const enter = (target: Element): void => {
    target.dispatchEvent(
      new KeyboardEvent('keydown', { key: 'Enter', bubbles: true, cancelable: true }),
    );
  };

  const button = (name: string): HTMLButtonElement | undefined =>
    Array.from(container.querySelectorAll('button')).find((b) => b.textContent.startsWith(name));

  it('keeps the title while the summary chunk is not there', async () => {
    await mount();
    expect(container.querySelector('h1')?.textContent).toBe(t('learn.summary.title'));
  });

  it('continues on Enter from the hidden field of the page', async () => {
    const { inputRef, onContinue, onHome } = await mount();
    if (inputRef.current === null) throw new Error('no input');
    enter(inputRef.current);
    expect(onContinue).toHaveBeenCalledTimes(1);
    expect(onHome).not.toHaveBeenCalled();
  });

  it('leaves Enter on a button to the button', async () => {
    const { onContinue } = await mount();
    const first = container.querySelector('button');
    if (first === null) throw new Error('no button');
    enter(first);
    expect(onContinue).not.toHaveBeenCalled();
  });

  it('goes home on a click of its button', async () => {
    const { onHome } = await mount();
    button(t('learn.summary.home'))?.click();
    expect(onHome).toHaveBeenCalledTimes(1);
  });

  it('has `continue` first and `home` second, with Enter on `continue`', async () => {
    await mount();
    const names = Array.from(container.querySelectorAll('button')).map((b) => b.textContent);
    expect(names[0]).toContain(t('learn.summary.continue'));
    expect(names[0]).toContain(t('key.enter'));
    expect(names[1]).toBe(t('learn.summary.home'));
  });

  it('with nothing to do: no continue, the time of the next review and home on Enter', async () => {
    const { inputRef, onContinue, onHome } = await mount({
      kind: 'none',
      nextAt: Date.now() + 3_600_000,
    });
    expect(button(t('learn.summary.continue'))).toBeUndefined();
    const line = container.querySelector('[data-testid="summary-nothing"]')?.textContent ?? '';
    expect(line.startsWith(`${t('learn.reason.none')} · `)).toBe(true);
    expect(line).toContain(t('learn.nextReview', { when: '' }).replace(/\s*$/, ''));
    const home = button(t('learn.summary.home'));
    expect(home?.textContent).toContain(t('key.enter'));
    if (inputRef.current === null) throw new Error('no input');
    enter(inputRef.current);
    expect(onHome).toHaveBeenCalledTimes(1);
    expect(onContinue).not.toHaveBeenCalled();
  });

  it('does not start a session while the store has not planned', async () => {
    const { inputRef, onContinue, onHome } = await mount(null);
    if (inputRef.current === null) throw new Error('no input');
    enter(inputRef.current);
    expect(onContinue).not.toHaveBeenCalled();
    expect(onHome).not.toHaveBeenCalled();
  });
});
