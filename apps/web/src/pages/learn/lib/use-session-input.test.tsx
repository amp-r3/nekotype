// @vitest-environment happy-dom
import { describe, it, expect, afterEach, vi } from 'vitest';
import { render, createRef } from 'preact';
import { act } from 'preact/test-utils';
import { createLearnSession } from '../model/session';
import type { LearnSession } from '../model/session';
import { Clock0, Timers, readyStore, seededRng } from './test-util';
import { useSessionInput } from './use-session-input';

function Probe({ session }: { session: LearnSession }) {
  const ref = createRef<HTMLInputElement>();
  useSessionInput(session, ref);
  return <input ref={ref} />;
}

describe('useSessionInput', () => {
  let container: HTMLDivElement;

  afterEach(() => {
    render(null, container);
    container.remove();
  });

  it('does not end a session when the screen unmounts during the last pause', async () => {
    container = document.createElement('div');
    document.body.appendChild(container);
    const clock = new Clock0();
    const timers = new Timers();
    const store = await readyStore(clock, timers);
    const endSession = vi.spyOn(store, 'endSession');
    const session = createLearnSession({
      track: 'hiragana',
      store,
      clock,
      scheduler: timers,
      rng: seededRng(1),
      audio: { play: vi.fn() },
      strictness: () => 'learner',
      tasks: 1,
    });
    await act(() => {
      render(<Probe session={session} />, container);
    });
    session.start();
    session.attach({
      setBuffer: () => undefined,
      type: () => undefined,
      reject: () => undefined,
      finish: () => undefined,
      reset: () => undefined,
    });
    session.handleIntent({ kind: 'char', char: 'a' });
    expect(session.phase.value).toBe('answered');

    await act(() => {
      render(null, container);
    });
    timers.flush();

    expect(endSession).not.toHaveBeenCalled();
    expect(session.phase.value).toBe('idle');
  });
});
