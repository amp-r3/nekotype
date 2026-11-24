import { describe, it, expect, vi } from 'vitest';
import { signal } from '@preact/signals';
import type { LearnKanaKey } from '@nekotype/shared/types';
import { onSyncRequest } from '@/shared/lib';
import type { LearnStore } from '@/entities/learn';
import { canonicalFor } from '../lib/prompt';
import type { Strictness } from '../lib/prompt';
import { createLearnSession } from './session';
import type { LearnSession, SessionStore, TaskPort } from './session';
import { Clock0, Timers, key as hira, learnKana, readyStore, seededRng } from '../lib/test-util';

function port(): TaskPort & { calls: string[] } {
  const calls: string[] = [];
  return {
    calls,
    setBuffer: (text) => calls.push(`buffer:${text}`),
    type: (count) => calls.push(`type:${String(count)}`),
    reject: () => calls.push('reject'),
    finish: (result) => calls.push(`finish:${result}`),
    reset: () => calls.push('reset'),
  };
}

type Env = Awaited<ReturnType<typeof setup>>;

async function setup(
  options: {
    tasks?: number;
    seed?: number;
    strictness?: Strictness;
    /** Runs on the ready store before the session is created: seeds a log. */
    seedLog?: (store: LearnStore, clock: Clock0) => void;
  } = {},
) {
  const clock = new Clock0();
  const scheduler = new Timers();
  const store = await readyStore(clock, scheduler);
  options.seedLog?.(store, clock);
  const play = vi.fn();
  const session = createLearnSession({
    track: 'hiragana',
    store,
    clock,
    scheduler,
    rng: seededRng(options.seed ?? 7),
    audio: { play },
    strictness: () => options.strictness ?? 'learner',
    ...(options.tasks === undefined ? {} : { tasks: options.tasks }),
  });
  return { clock, scheduler, store, session, play };
}

/** A kana learned a month ago, so that its review is due. */
const dueLong =
  (...kana: string[]) =>
  (store: LearnStore, clock: Clock0): void => {
    for (const k of kana) learnKana(store, clock, k);
    clock.time += 30 * 86_400_000;
  };

/** Puts the task on screen the way the view does, and returns its port. */
function show(session: LearnSession): ReturnType<typeof port> {
  const p = port();
  session.attach(p);
  return p;
}

function typeRomaji(session: LearnSession, text: string): void {
  for (const char of text) session.handleIntent({ kind: 'char', char });
}

/** Answers the current task correctly and lets the timers run (the record, the pause). */
function answerRight({ session, scheduler, clock }: Env, ms = 600): void {
  const task = session.task.value;
  if (task === null) throw new Error('no task');
  show(session);
  clock.time += ms;
  if (task.kind === 'recognition') session.choose(task.options.indexOf(task.key));
  else typeRomaji(session, canonicalFor(task.key));
  scheduler.flush();
}

/** Answers right until a task of `kind` is shown. */
function until(env: Env, kind: 'introduction' | 'recall' | 'recognition'): void {
  for (let guard = 0; env.session.task.value?.kind !== kind; guard++) {
    if (guard > 200 || env.session.phase.value !== 'task') throw new Error(`no ${kind} task`);
    answerRight(env);
  }
}

describe('learning session: introductions', () => {
  it('starts with the introduction of あ, typed once, and records it after the key', async () => {
    const env = await setup();
    env.session.start();
    expect(env.session.task.value).toMatchObject({ kind: 'introduction', kana: 'あ', n: 1 });
    show(env.session);
    typeRomaji(env.session, 'a');
    // The key handler records nothing: the store holds no introduction until the timers run.
    expect(env.store.view.value?.kana.get(hira('あ'))?.state).toBe('locked');
    env.scheduler.flush();
    expect(env.store.view.value?.kana.get(hira('あ'))?.state).toBe('learning');
    // An introduction is not an answer.
    expect(env.store.view.value?.kana.get(hira('あ'))?.recall).toEqual([]);
  });

  it('introduces the five vowels one after another in a first session (LEARN_MAX = 5)', async () => {
    const env = await setup();
    env.session.start();
    const shown: string[] = [];
    for (let i = 0; i < 5; i++) {
      const task = env.session.task.value;
      shown.push(task?.kind === 'introduction' ? task.kana : (task?.kind ?? 'none'));
      answerRight(env);
    }
    expect(shown).toEqual(['あ', 'い', 'う', 'え', 'お']);
    // The limit is reached: the sixth task is one of the five learning kana.
    expect(env.session.task.value?.kind).not.toBe('introduction');
  });

  it('moves the ghost hint with each letter and ignores a wrong key without an error', async () => {
    const env = await setup();
    env.session.start();
    const p = show(env.session);
    typeRomaji(env.session, 'x');
    typeRomaji(env.session, 'a');
    expect(p.calls).toEqual(['reject', 'type:1', 'finish:correct']);
  });

  it('plays the kana after every task, introductions included', async () => {
    const env = await setup();
    env.session.start();
    answerRight(env);
    expect(env.play).toHaveBeenCalledWith(hira('あ'));
  });

  it('takes only the romaji the introduction shows: hu is not fu', async () => {
    // ふ is the one kana left that the planner can introduce when the earlier ones are learned.
    const env = await setup({
      seedLog: (store, clock) => {
        for (const kana of ['あ', 'い', 'う', 'え', 'お']) learnKana(store, clock, kana);
        for (const kana of ['か', 'き', 'く', 'け', 'こ']) learnKana(store, clock, kana);
        clock.time += 1000;
      },
    });
    env.session.start();
    for (let guard = 0; guard < 60; guard++) {
      const task = env.session.task.value;
      if (task?.kind === 'introduction' && task.kana === 'さ') break;
      answerRight(env);
    }
    const task = env.session.task.value;
    expect(task).toMatchObject({ kind: 'introduction', kana: 'さ', romaji: 'sa' });
  });
});

describe('learning session: flow', () => {
  it('runs 30 tasks to the summary and counts the session once each way', async () => {
    const env = await setup();
    env.session.start();
    expect(env.store.view.value?.stats.started).toBe(1);
    const numbers: number[] = [];
    while (env.session.phase.value === 'task') {
      numbers.push(env.session.task.value?.n ?? 0);
      answerRight(env);
    }
    expect(numbers).toEqual(Array.from({ length: 30 }, (_, i) => i + 1));
    expect(env.session.total).toBe(30);
    expect(env.session.phase.value).toBe('summary');
    expect(env.store.view.value?.stats.finished).toBe(1);
    expect(env.session.summary.value).not.toBeNull();
    expect(env.session.summary.value?.introduced.length).toBeGreaterThan(0);
  });

  it('asks for a sync when the session reaches its summary, and not before', async () => {
    const asked = vi.fn();
    const off = onSyncRequest(asked);
    const env = await setup();
    env.session.start();
    answerRight(env);
    expect(asked).not.toHaveBeenCalled();
    while (env.session.phase.value === 'task') answerRight(env);
    expect(asked).toHaveBeenCalledOnce();
    off();
  });

  it('never repeats the kana of the previous task', async () => {
    const env = await setup({ seed: 3 });
    env.session.start();
    let last: LearnKanaKey | null = null;
    while (env.session.phase.value === 'task') {
      const key = env.session.task.value?.key ?? null;
      expect(key).not.toBe(last);
      last = key;
      answerRight(env);
    }
  });

  it('holds the result for the answer pause, ignoring keys until the next task', async () => {
    const env = await setup();
    env.session.start();
    const first = env.session.task.value;
    show(env.session);
    typeRomaji(env.session, 'a');
    expect(env.session.phase.value).toBe('answered');
    typeRomaji(env.session, 'i');
    expect(env.session.task.value).toBe(first);
    env.scheduler.flush();
    expect(env.session.task.value?.n).toBe(2);
  });

  it('ignores keys before the task is on screen', async () => {
    const env = await setup();
    env.session.start();
    typeRomaji(env.session, 'a');
    expect(env.session.phase.value).toBe('task');
    env.scheduler.flush();
    expect(env.store.view.value?.kana.get(hira('あ'))?.state).toBe('locked');
  });

  it('plans each task on the answers before it: a kana answered wrong comes back', async () => {
    const env = await setup({ seed: 5 });
    env.session.start();
    until(env, 'recall');
    const task = env.session.task.value;
    if (task?.kind !== 'recall') throw new Error('not recall');
    show(env.session);
    typeRomaji(env.session, 'x');
    typeRomaji(env.session, canonicalFor(task.key));
    env.scheduler.flush();
    const seen: LearnKanaKey[] = [];
    for (let i = 0; i < 12 && env.session.phase.value === 'task'; i++) {
      const next = env.session.task.value;
      if (next !== null) seen.push(next.key);
      answerRight(env);
    }
    expect(seen).toContain(task.key);
  });

  it('ends early, with the end recorded, when the planner has nothing to offer', () => {
    const endSession = vi.fn();
    const store: SessionStore = {
      view: signal(null),
      modelState: () => null,
      startSession: vi.fn(),
      endSession,
      introduce: vi.fn(),
      recordAnswer: vi.fn(),
    };
    const clock = new Clock0();
    const session = createLearnSession({
      track: 'hiragana',
      store,
      clock,
      scheduler: new Timers(),
      rng: seededRng(1),
      audio: { play: vi.fn() },
      strictness: () => 'learner',
    });
    session.start();
    expect(session.phase.value).toBe('summary');
    expect(endSession).toHaveBeenCalledOnce();
    expect(session.summary.value).toMatchObject({ introduced: [], learned: [] });
  });
});

describe('learning session: deferred recording (D18)', () => {
  it('calls nothing of the store inside a key handler, only after the timers run', async () => {
    const env = await setup({ seed: 11 });
    env.session.start();
    until(env, 'recall');
    const task = env.session.task.value;
    if (task?.kind !== 'recall') throw new Error('not recall');
    const recordAnswer = vi.spyOn(env.store, 'recordAnswer');
    const introduce = vi.spyOn(env.store, 'introduce');
    show(env.session);
    typeRomaji(env.session, canonicalFor(task.key));
    expect(recordAnswer).not.toHaveBeenCalled();
    expect(introduce).not.toHaveBeenCalled();
    env.scheduler.flush();
    expect(recordAnswer).toHaveBeenCalledOnce();
  });

  it('still records an answer when the learner leaves before the timers run', async () => {
    const env = await setup({ seed: 11 });
    env.session.start();
    show(env.session);
    typeRomaji(env.session, 'a');
    env.session.leave();
    env.scheduler.flush();
    expect(env.store.view.value?.kana.get(hira('あ'))?.state).toBe('learning');
    expect(env.store.view.value?.stats.finished).toBe(0);
  });
});

describe('learning session: recall', () => {
  it('records a clean answer with its time', async () => {
    const env = await setup({ seed: 11 });
    env.session.start();
    until(env, 'recall');
    const task = env.session.task.value;
    if (task?.kind !== 'recall') throw new Error('not recall');
    const p = show(env.session);
    env.clock.time += 900;
    typeRomaji(env.session, canonicalFor(task.key));
    expect(p.calls.at(-1)).toBe('finish:correct');
    env.scheduler.flush();
    const recall = env.store.view.value?.kana.get(task.key)?.recall ?? [];
    expect(recall.at(-1)).toMatchObject({ ok: true });
    expect(recall.at(-1)?.ms).toBeGreaterThan(0);
  });

  it('counts a rejected key as an error and flashes the caret', async () => {
    const env = await setup({ seed: 11 });
    env.session.start();
    until(env, 'recall');
    const task = env.session.task.value;
    if (task?.kind !== 'recall') throw new Error('not recall');
    const p = show(env.session);
    typeRomaji(env.session, 'x');
    typeRomaji(env.session, canonicalFor(task.key));
    expect(p.calls[0]).toBe('reject');
    expect(p.calls.at(-1)).toBe('finish:miss');
    env.scheduler.flush();
    expect(env.store.view.value?.kana.get(task.key)?.recall.at(-1)?.ok).toBe(false);
  });

  it('shows the romaji on Esc and counts it as an error, with no kana as the wrong answer', async () => {
    const env = await setup({ seed: 11 });
    env.session.start();
    until(env, 'recall');
    const task = env.session.task.value;
    if (task?.kind !== 'recall') throw new Error('not recall');
    show(env.session);
    env.session.handleIntent({ kind: 'reveal' });
    expect(env.session.notice.value).toEqual({
      kind: 'revealed',
      answer: canonicalFor(task.key),
    });
    typeRomaji(env.session, canonicalFor(task.key));
    env.scheduler.flush();
    const view = env.store.view.value?.kana.get(task.key);
    expect(view?.recall.at(-1)?.ok).toBe(false);
    expect(view?.confusions).toEqual([]);
  });

  it('starts the task over when the tab was hidden, keeping an earlier error', async () => {
    const env = await setup({ seed: 11 });
    env.session.start();
    until(env, 'recall');
    const task = env.session.task.value;
    if (task?.kind !== 'recall') throw new Error('not recall');
    const p = show(env.session);
    typeRomaji(env.session, 'x');
    env.clock.time += 5000;
    env.session.restart();
    expect(p.calls.at(-1)).toBe('reset');
    expect(env.session.notice.value).toEqual({ kind: 'restarted' });
    env.clock.time += 700;
    typeRomaji(env.session, canonicalFor(task.key));
    env.scheduler.flush();
    expect(env.store.view.value?.kana.get(task.key)?.recall.at(-1)).toMatchObject({ ok: false });
  });
});

describe('learning session: the kana a wrong answer matched (D18)', () => {
  /** A session whose first task is the review of `kana`, the only due kana. */
  async function reviewing(kana: string, strictness: Strictness = 'learner') {
    const env = await setup({ strictness, seedLog: dueLong(kana) });
    env.session.start();
    expect(env.session.task.value).toMatchObject({ kind: 'recall', key: hira(kana) });
    return env;
  }

  it('is す for し typed as `su`: the prefix `s` and the rejected key `u`', async () => {
    const env = await reviewing('し');
    show(env.session);
    typeRomaji(env.session, 'su');
    typeRomaji(env.session, 'shi');
    env.scheduler.flush();
    expect(env.store.view.value?.kana.get(hira('し'))?.confusions).toEqual([
      { key: hira('す'), count: 1 },
    ]);
  });

  it('is nothing for か typed with a `g`: no kana is spelled `g`', async () => {
    const env = await reviewing('か');
    show(env.session);
    typeRomaji(env.session, 'g');
    typeRomaji(env.session, 'ka');
    env.scheduler.flush();
    const view = env.store.view.value?.kana.get(hira('か'));
    expect(view?.recall.at(-1)?.ok).toBe(false);
    expect(view?.confusions).toEqual([]);
  });

  it('is nothing for ぢ typed as `ji` in relaxed mode: じ and ぢ both accept it', async () => {
    const env = await reviewing('ぢ');
    show(env.session);
    typeRomaji(env.session, 'ji');
    typeRomaji(env.session, 'di');
    env.scheduler.flush();
    expect(env.store.view.value?.kana.get(hira('ぢ'))?.confusions).toEqual([]);
  });

  it('takes the first error only', async () => {
    const env = await reviewing('し');
    show(env.session);
    typeRomaji(env.session, 'x');
    typeRomaji(env.session, 'su');
    typeRomaji(env.session, 'shi');
    env.scheduler.flush();
    expect(env.store.view.value?.kana.get(hira('し'))?.confusions).toEqual([]);
  });
});

describe('learning session: recognition', () => {
  async function toRecognition(): Promise<Env> {
    const env = await setup({ seed: 5 });
    env.session.start();
    until(env, 'recognition');
    return env;
  }

  it('offers four options and moves on after the pause when the choice is right', async () => {
    const env = await toRecognition();
    const task = env.session.task.value;
    if (task?.kind !== 'recognition') throw new Error('not recognition');
    expect(task.options).toHaveLength(4);
    expect(task.options).toContain(task.key);
    show(env.session);
    env.clock.time += 800;
    env.session.choose(task.options.indexOf(task.key));
    expect(env.session.choice.value).toEqual({ chosen: task.key, correct: true });
    expect(env.session.phase.value).toBe('answered');
    env.scheduler.flush();
    expect(env.session.task.value).not.toBe(task);
    const view = env.store.view.value?.kana.get(task.key);
    expect(view?.recognitions).toBe(1);
    expect(view?.recognitionErrors).toBe(0);
  });

  it('records a wrong choice as a confusion and waits for a key or a click', async () => {
    const env = await toRecognition();
    const task = env.session.task.value;
    if (task?.kind !== 'recognition') throw new Error('not recognition');
    show(env.session);
    const wrong = task.options.findIndex((option) => option !== task.key);
    const chosen = task.options[wrong];
    env.session.choose(wrong);
    expect(env.session.phase.value).toBe('waiting');
    expect(env.session.notice.value).toEqual({ kind: 'next' });
    env.scheduler.flush();
    expect(env.store.view.value?.kana.get(task.key)?.confusions).toEqual([
      { key: chosen, count: 1 },
    ]);
    // The timer does not move on by itself.
    expect(env.session.task.value).toBe(task);
    env.session.advance();
    expect(env.session.task.value).not.toBe(task);
  });

  it('ignores a second choice and an index with no option', async () => {
    const env = await toRecognition();
    const task = env.session.task.value;
    if (task?.kind !== 'recognition') throw new Error('not recognition');
    show(env.session);
    env.session.choose(9);
    expect(env.session.choice.value).toBeNull();
    env.session.choose(task.options.indexOf(task.key));
    env.session.choose(0);
    env.scheduler.flush();
    expect(env.store.view.value?.kana.get(task.key)?.recognitions).toBe(1);
  });

  it('puts the kana most confused with the answer among the options', async () => {
    // あ is learning with three recognition errors that gave め, a kana nothing else suggests.
    const env = await setup({
      seed: 1,
      seedLog: (store, clock) => {
        store.introduce(hira('あ'));
        for (let i = 0; i < 3; i++) {
          clock.time += 1000;
          store.recordAnswer({
            task: 'recognition',
            key: hira('あ'),
            ok: false,
            ms: 900,
            hint: false,
            wrong: hira('め'),
            alt: null,
          });
        }
        clock.time += 600_000;
      },
    });
    env.session.start();
    let found: readonly LearnKanaKey[] | null = null;
    for (let guard = 0; guard < 100 && found === null; guard++) {
      const task = env.session.task.value;
      if (task?.kind === 'recognition' && task.key === hira('あ')) found = task.options;
      if (found === null) answerRight(env);
    }
    expect(found).toContain(hira('め'));
  });
});

describe('learning session: leaving', () => {
  it('stops without a summary or an end, and keeps the recorded answers', async () => {
    const env = await setup();
    env.session.start();
    answerRight(env);
    env.session.leave();
    expect(env.session.phase.value).toBe('idle');
    expect(env.session.summary.value).toBeNull();
    expect(env.store.view.value?.stats.finished).toBe(0);
    expect(env.store.view.value?.kana.get(hira('あ'))?.state).toBe('learning');
    // The pause timer is gone.
    env.scheduler.flush();
    expect(env.session.phase.value).toBe('idle');
  });
});

describe('learning session: determinism and leaving', () => {
  function record(env: Env): string[] {
    env.session.start();
    const seen: string[] = [];
    for (let i = 0; i < 30; i++) {
      const task = env.session.task.value;
      if (task === null) break;
      seen.push(
        `${task.kind}:${task.key}:${task.kind === 'recognition' ? task.options.join(',') : ''}`,
      );
      answerRight(env);
    }
    return seen;
  }

  it('gives the same tasks, kana and options for the same log and seed', async () => {
    const first = record(await setup({ seed: 7 }));
    const second = record(await setup({ seed: 7 }));
    expect(first).toHaveLength(30);
    expect(second).toEqual(first);
  });

  it('keeps the summary when the screen leaves the session after its end', async () => {
    const env = await setup({ tasks: 1 });
    env.session.start();
    answerRight(env);
    expect(env.session.phase.value).toBe('summary');
    env.session.leave();
    expect(env.session.phase.value).toBe('summary');
    expect(env.session.summary.value).not.toBeNull();
  });
});
