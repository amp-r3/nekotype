// @vitest-environment happy-dom
import { describe, it, expect, afterEach, beforeEach, vi } from 'vitest';
import { render, options, createRef, Fragment } from 'preact';
import type { VNode } from 'preact';
import { act } from 'preact/test-utils';
import { STORAGE_KEYS, createMemoryDb, immersive } from '@/shared/lib';
import type { Db, Write } from '@/shared/lib';
import { canonicalFor } from '@/entities/prompt';
import { t } from '@/shared/i18n';
import { createLearnStore } from '@/entities/learn';
import { createLearnSession } from '../model/session';
import type { LearnSession } from '../model/session';
import { Clock0, Timers, seededRng } from '../lib/test-util';
import { SessionScreen } from './session-screen';

const tick = (): Promise<void> => new Promise((resolve) => setTimeout(resolve, 0));

function setup(seed: number, tasks?: number) {
  const clock = new Clock0();
  const timers = new Timers();
  const db = createMemoryDb();
  const writes: Write[][] = [];
  const spied: Db = {
    ...db,
    write: (batch) => {
      writes.push([...batch]);
      return db.write(batch);
    },
  };
  const store = createLearnStore({
    db: () => Promise.resolve(spied),
    clock,
    scheduler: timers,
    targetMs: () => 1500,
  });
  const session = createLearnSession({
    track: 'hiragana',
    store,
    clock,
    scheduler: timers,
    rng: seededRng(seed),
    audio: { play: vi.fn() },
    strictness: () => 'learner',
    targetMs: () => 1500,
    ...(tasks === undefined ? {} : { tasks }),
  });
  return { clock, timers, store, session, writes };
}

describe('learning session screen', () => {
  let container: HTMLDivElement;
  let input: HTMLInputElement;
  let prevDiffed: ((vnode: VNode) => void) | undefined;

  beforeEach(() => {
    container = document.createElement('div');
    document.body.appendChild(container);
    prevDiffed = options.diffed?.bind(options);
  });

  afterEach(() => {
    if (prevDiffed) options.diffed = prevDiffed;
    else delete options.diffed;
    render(null, container);
    container.remove();
  });

  async function mount(session: LearnSession, onEnd: () => void = () => undefined): Promise<void> {
    const ref = createRef<HTMLInputElement>();
    await act(() => {
      render(
        <>
          <input ref={ref} />
          <SessionScreen session={session} inputRef={ref} onLeave={() => undefined} onEnd={onEnd} />
        </>,
        container,
      );
    });
    session.start();
    await act(tick);
    if (ref.current === null) throw new Error('no input');
    input = ref.current;
  }

  /** The components that rendered while `action` ran and Preact had its turn. */
  async function rendered(action: () => void): Promise<string[]> {
    const names: string[] = [];
    options.diffed = (vnode: VNode) => {
      if (typeof vnode.type === 'function' && vnode.type !== Fragment) names.push(vnode.type.name);
      if (prevDiffed) prevDiffed(vnode);
    };
    action();
    await tick();
    if (prevDiffed) options.diffed = prevDiffed;
    else delete options.diffed;
    return names;
  }

  const press = (key: string, code = ''): void => {
    input.dispatchEvent(
      new KeyboardEvent('keydown', { key, code, bubbles: true, cancelable: true }),
    );
  };

  /** Answers tasks (introductions first) until the task on screen is `kind`. */
  async function toTask(
    env: ReturnType<typeof setup>,
    kind: 'recall' | 'recognition',
  ): Promise<void> {
    while (env.session.task.value?.kind !== kind) {
      const task = env.session.task.value;
      if (task === null) throw new Error('no task');
      if (task.kind === 'recognition') {
        press(
          String(task.options.indexOf(task.key) + 1),
          `Digit${String(task.options.indexOf(task.key) + 1)}`,
        );
      } else {
        for (const char of canonicalFor(task.key)) press(char);
      }
      await act(async () => {
        env.timers.flush();
        await tick();
      });
    }
  }

  it('tells the page when the last task is answered', async () => {
    const env = setup(1, 1);
    const onEnd = vi.fn();
    await mount(env.session, onEnd);
    expect(onEnd).not.toHaveBeenCalled();
    press('a');
    await act(async () => {
      env.timers.flush();
      await tick();
    });
    expect(env.session.phase.value).toBe('summary');
    expect(onEnd).toHaveBeenCalledTimes(1);
  });

  it('hides the navigation while it is on screen and shows it again after', async () => {
    const env = setup(1);
    await mount(env.session);
    expect(immersive.value).toBe(true);
    await act(() => {
      render(null, container);
    });
    expect(immersive.value).toBe(false);
  });

  it('renders nothing for a recall keystroke, the answer or Esc; one render for the next task', async () => {
    const env = setup(11);
    await mount(env.session);
    await toTask(env, 'recall');
    const task = env.session.task.value;
    if (task?.kind !== 'recall') throw new Error('not recall');
    const romaji = canonicalFor(task.key);

    expect(
      await rendered(() => {
        press('x');
      }),
    ).toEqual([]);
    expect(
      await rendered(() => {
        press('Escape');
      }),
    ).toEqual([]);
    for (const char of romaji)
      expect(
        await rendered(() => {
          press(char);
        }),
      ).toEqual([]);
    expect(env.session.phase.value).toBe('answered');

    const next = await rendered(() => {
      env.timers.flush();
    });
    expect(next.filter((name) => name === 'SessionScreen')).toHaveLength(1);
    expect(next.filter((name) => name === 'KanaTask')).toHaveLength(1);
  });

  it('renders at most once for a recognition answer', async () => {
    const env = setup(5);
    await mount(env.session);
    await toTask(env, 'recognition');
    const task = env.session.task.value;
    if (task?.kind !== 'recognition') throw new Error('not recognition');
    const right = task.options.indexOf(task.key) + 1;
    const names = await rendered(() => {
      press(String(right), `Digit${String(right)}`);
    });
    expect(names.filter((name) => name === 'SessionScreen').length).toBeLessThanOrEqual(1);
    expect(env.session.choice.value?.correct).toBe(true);
  });

  it('takes a wrong choice by number, then moves on with Enter', async () => {
    const env = setup(5);
    await mount(env.session);
    await toTask(env, 'recognition');
    const task = env.session.task.value;
    if (task?.kind !== 'recognition') throw new Error('not recognition');
    const wrong = task.options.findIndex((key) => key !== task.key) + 1;
    press(String(wrong), `Digit${String(wrong)}`);
    await act(tick);
    expect(env.session.phase.value).toBe('waiting');
    expect(container.querySelector('[role="status"]')?.textContent).not.toBe('');
    press('Enter');
    await act(tick);
    expect(env.session.task.value).not.toBe(task);
  });

  it('hints how to go on after a wrong choice: Enter and the word next, and a button on a touch screen', async () => {
    for (const touch of [false, true]) {
      vi.stubGlobal('matchMedia', (query: string) => ({
        matches: touch && query.includes('pointer: coarse'),
        media: query,
        addEventListener: () => undefined,
        removeEventListener: () => undefined,
      }));
      const env = setup(5);
      await mount(env.session);
      await toTask(env, 'recognition');
      const task = env.session.task.value;
      if (task?.kind !== 'recognition') throw new Error('not recognition');
      const wrong = task.options.findIndex((key) => key !== task.key) + 1;
      press(String(wrong), `Digit${String(wrong)}`);
      await act(tick);

      const hint = container.querySelector('.nk-task__notice');
      const goOn = Array.from(container.querySelectorAll('button')).find((button) =>
        button.classList.contains('nk-task__next'),
      );
      if (touch) {
        expect(goOn?.textContent).toBe(t('learn.session.next'));
        expect(hint?.querySelector('kbd')).toBeNull();
        await act(() => {
          goOn?.click();
        });
        await act(tick);
        expect(env.session.task.value).not.toBe(task);
      } else {
        expect(goOn).toBeUndefined();
        expect(hint?.querySelector('kbd')?.textContent).toBe(t('key.enter'));
        expect(hint?.textContent).toContain(t('learn.session.next'));
      }
      render(null, container);
      vi.unstubAllGlobals();
    }
  });

  it('writes no IndexedDB record inside a keystroke handler, and does not touch typing progress', async () => {
    const env = setup(11);
    await mount(env.session);
    await toTask(env, 'recall');
    const before = env.writes.length;
    const current = env.session.task.value;
    if (current?.kind !== 'recall') throw new Error('not recall');
    for (const char of canonicalFor(current.key)) {
      press(char);
      expect(env.writes.length).toBe(before);
    }
    // The write follows outside the handler.
    env.timers.flush();
    await tick();
    expect(env.writes.length).toBeGreaterThan(before);
    expect(localStorage.getItem(STORAGE_KEYS.PROGRESS)).toBeNull();
  });
});
