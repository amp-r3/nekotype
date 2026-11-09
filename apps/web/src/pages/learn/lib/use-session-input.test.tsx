// @vitest-environment happy-dom
import { describe, it, expect, afterEach, vi } from 'vitest';
import { render, createRef } from 'preact';
import { act } from 'preact/test-utils';
import { createMemoryDb } from '@/shared/lib';
import { createLearnStore } from '@/entities/learn';
import { createLearnSession } from '../model/session';
import type { LearnSession } from '../model/session';
import { Clock0, Timers, seededRng } from './test-util';
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

  it('does not count a session as finished when the screen unmounts during the last pause', async () => {
    container = document.createElement('div');
    document.body.appendChild(container);
    const clock = new Clock0();
    const timers = new Timers();
    const db = createMemoryDb();
    const store = createLearnStore({
      db: () => Promise.resolve(db),
      clock,
      scheduler: timers,
      targetMs: () => 1500,
    });
    const countSession = vi.spyOn(store, 'countSession');
    const session = createLearnSession({
      track: 'hiragana',
      store,
      clock,
      scheduler: timers,
      rng: seededRng(1),
      audio: { play: vi.fn() },
      strictness: () => 'learner',
      targetMs: () => 1500,
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

    expect(countSession).not.toHaveBeenCalledWith('finished');
    expect(session.phase.value).toBe('idle');
  });
});
