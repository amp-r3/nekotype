import { describe, it, expect, vi } from 'vitest';
import type { LearnKanaKey } from '@nekotype/shared/types';
import { createMemoryDb } from '@/shared/lib';
import { canonicalFor } from '@/entities/prompt';
import { createLearnStore, keyOf } from '@/entities/learn';
import { createLearnSession } from './session';
import type { LearnSession, TaskPort } from './session';
import { Clock0, Timers, key as hira, seededRng, stateWith } from '../lib/test-util';
import { initialCounters } from '@/entities/learn';

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

function setup(options: { tasks?: number; seed?: number } = {}) {
  const clock = new Clock0();
  const scheduler = new Timers();
  const db = createMemoryDb();
  const store = createLearnStore({
    db: () => Promise.resolve(db),
    clock,
    scheduler,
    targetMs: () => 1500,
  });
  const play = vi.fn();
  const session = createLearnSession({
    track: 'hiragana',
    store,
    clock,
    scheduler,
    rng: seededRng(options.seed ?? 7),
    audio: { play },
    strictness: () => 'learner',
    targetMs: () => 1500,
    ...(options.tasks === undefined ? {} : { tasks: options.tasks }),
  });
  return { clock, scheduler, store, session, play };
}

/** A session whose first task is the introduction of `kana`: it is the one unlocked kana without an entry. */
async function introducing(kana: string, strictness: 'learner' | 'ime' = 'learner') {
  const clock = new Clock0();
  const scheduler = new Timers();
  const db = createMemoryDb();
  await db.put('delta', 'learn', {
    learn: stateWith({ unlocked: [kana] }),
    counters: initialCounters(),
  });
  const store = createLearnStore({
    db: () => Promise.resolve(db),
    clock,
    scheduler,
    targetMs: () => 1500,
  });
  await store.init();
  const session = createLearnSession({
    track: 'hiragana',
    store,
    clock,
    scheduler,
    rng: seededRng(3),
    audio: { play: vi.fn() },
    strictness: () => strictness,
    targetMs: () => 1500,
  });
  session.start();
  return { clock, scheduler, store, session };
}

/** Puts the task on screen the way the view does, and returns its port. */
function show(session: LearnSession): ReturnType<typeof port> {
  const p = port();
  session.attach(p);
  return p;
}

function typeRomaji(session: LearnSession, text: string): void {
  for (const char of text) session.handleIntent({ kind: 'char', char });
}

/** Answers the current task correctly and lets the pause pass. */
function answerRight({ session, scheduler, clock }: ReturnType<typeof setup>, ms = 600): void {
  const task = session.task.value;
  if (task === null) throw new Error('no task');
  show(session);
  clock.time += ms;
  if (task.kind === 'recognition') session.choose(task.options.indexOf(task.key));
  else typeRomaji(session, canonicalFor(task.key));
  scheduler.flush();
}

describe('learning session: introductions', () => {
  it('starts with the five vowels in order, each typed once', () => {
    const env = setup();
    env.session.start();
    const kana: string[] = [];
    for (let i = 0; i < 5; i++) {
      const task = env.session.task.value;
      expect(task?.kind).toBe('introduction');
      kana.push(task?.kind === 'introduction' ? task.kana : '');
      answerRight(env);
    }
    expect(kana).toEqual(['あ', 'い', 'う', 'え', 'お']);
    expect(Object.keys(env.store.state.value.entries)).toHaveLength(5);
    // An introduction is not an answer.
    expect(env.store.state.value.recent).toEqual({});
  });

  it('moves the ghost hint with each letter and ignores a wrong key without an error', () => {
    const env = setup();
    env.session.start();
    // Reach a task with a two-letter hint: none among the vowels, so check the vowel hint.
    const p = show(env.session);
    typeRomaji(env.session, 'x');
    typeRomaji(env.session, 'a');
    expect(p.calls).toEqual(['reject', 'type:1', 'finish:correct']);
  });

  it('plays the kana after every task, introductions included', () => {
    const env = setup();
    env.session.start();
    answerRight(env);
    expect(env.play).toHaveBeenCalledWith(hira('あ'));
  });
});

describe('learning session: flow', () => {
  it('runs 25 tasks to the summary and counts the session once each way', () => {
    const env = setup();
    env.session.start();
    expect(env.store.counters.value.started.learn).toBe(1);
    const numbers: number[] = [];
    while (env.session.phase.value === 'task') {
      numbers.push(env.session.task.value?.n ?? 0);
      answerRight(env);
    }
    expect(numbers).toEqual(Array.from({ length: 25 }, (_, i) => i + 1));
    expect(env.session.phase.value).toBe('summary');
    expect(env.store.counters.value.finished.learn).toBe(1);
    expect(env.session.summary.value).not.toBeNull();
  });

  it('never repeats the kana of the previous task', () => {
    const env = setup({ seed: 3 });
    env.session.start();
    let last: LearnKanaKey | null = null;
    while (env.session.phase.value === 'task') {
      const key = env.session.task.value?.key ?? null;
      expect(key).not.toBe(last);
      last = key;
      answerRight(env);
    }
  });

  it('holds the result for the answer pause, ignoring keys until the next task', () => {
    const env = setup();
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

  it('ignores keys before the task is on screen', () => {
    const env = setup();
    env.session.start();
    typeRomaji(env.session, 'a');
    expect(env.session.phase.value).toBe('task');
    expect(env.store.state.value.entries).toEqual({});
  });

  it('introduces a kana that unlocks during the session as the next task', () => {
    const env = setup();
    env.session.start();
    for (let i = 0; i < 5; i++) answerRight(env);
    // Make the five vowels confident: ten fast, correct answers each.
    for (const kana of ['あ', 'い', 'う', 'え', 'お']) {
      for (let i = 0; i < 10; i++) {
        env.store.recordRecall({
          key: hira(kana),
          keystrokes: [{ t: 500, accepted: true }],
          ok: true,
        });
      }
    }
    expect(env.store.state.value.unlocked.hiragana).toHaveLength(6);
    answerRight(env);
    const task = env.session.task.value;
    expect(task?.kind).toBe('introduction');
    expect(task?.kind === 'introduction' ? task.kana : '').toBe('か');
  });
});

describe('learning session: the introduction takes only the romaji it shows (ADR 062)', () => {
  it('rejects another spelling of the kana: hu for ふ, which shows fu', async () => {
    const env = await introducing('ふ');
    const task = env.session.task.value;
    expect(task).toMatchObject({ kind: 'introduction', romaji: 'fu' });
    const p = show(env.session);
    typeRomaji(env.session, 'h');
    expect(p.calls).toEqual(['reject']);
    typeRomaji(env.session, 'fu');
    expect(p.calls).toEqual(['reject', 'type:1', 'type:2', 'finish:correct']);
    expect(env.store.state.value.entries[hira('ふ')]).toBeDefined();
    // Nothing is recorded: an introduction is not an answer.
    expect(env.store.state.value.recent).toEqual({});
  });

  it.each([
    ['し', 'shi', 'si'],
    ['つ', 'tsu', 'tu'],
    ['ち', 'chi', 'ti'],
  ])('shows %s as %s and does not take %s', async (kana, shown, other) => {
    const env = await introducing(kana);
    expect(env.session.task.value).toMatchObject({ kind: 'introduction', romaji: shown });
    const p = show(env.session);
    typeRomaji(env.session, other);
    // The first letter is shared (s, t, t); the second is not the shown one.
    expect(p.calls.at(-1)).toBe('reject');
    expect(p.calls).not.toContain('finish:correct');
  });

  it('shows ん as n and completes it on one n', async () => {
    const env = await introducing('ん');
    expect(env.session.task.value).toMatchObject({ kind: 'introduction', kana: 'ん', romaji: 'n' });
    const p = show(env.session);
    typeRomaji(env.session, 'n');
    expect(p.calls).toEqual(['type:1', 'finish:correct']);
  });

  it('shows ん as n in a recognition prompt and as the answer after Esc, in both strictnesses', async () => {
    for (const strictness of ['learner', 'ime'] as const) {
      const env = await introducing('ん', strictness);
      show(env.session);
      typeRomaji(env.session, 'n');
      env.scheduler.flush();
      let recognition = false;
      let revealed = false;
      // Only ん is unlocked, so the tasks are about it; stop once both cases have been seen.
      for (let guard = 0; guard < 24 && !(recognition && revealed); guard++) {
        const task = env.session.task.value;
        show(env.session);
        if (task?.kind === 'recognition') {
          expect(task.romaji).toBe('n');
          recognition = true;
          env.session.choose(task.options.indexOf(task.key));
        } else if (task?.kind === 'recall') {
          if (!revealed) {
            env.session.handleIntent({ kind: 'reveal' });
            expect(env.session.notice.value).toEqual({ kind: 'revealed', answer: 'n' });
            revealed = true;
          }
          typeRomaji(env.session, 'n');
        }
        env.scheduler.flush();
      }
      expect(recognition).toBe(true);
      expect(revealed).toBe(true);
    }
  });
});

describe('learning session: recall', () => {
  // Reach a recall task: introduce the vowels, then take tasks until one is recall.
  function toRecall(env: ReturnType<typeof setup>): void {
    env.session.start();
    for (let i = 0; i < 5; i++) answerRight(env);
    while (env.session.task.value?.kind !== 'recall') answerRight(env);
  }

  it('records a clean answer with its time and shows the buffer', () => {
    const env = setup({ seed: 11 });
    toRecall(env);
    const task = env.session.task.value;
    if (task?.kind !== 'recall') throw new Error('not recall');
    const p = show(env.session);
    env.clock.time += 900;
    typeRomaji(env.session, canonicalFor(task.key));
    expect(p.calls.at(-1)).toBe('finish:correct');
    const recent = env.store.state.value.recent[task.key] ?? [];
    expect(recent).toHaveLength(1);
    expect(recent[0]).toMatchObject({ ok: true, ms: 900 });
  });

  it('counts a rejected key as an error and flashes the caret', () => {
    const env = setup({ seed: 11 });
    toRecall(env);
    const task = env.session.task.value;
    if (task?.kind !== 'recall') throw new Error('not recall');
    const p = show(env.session);
    typeRomaji(env.session, 'x');
    typeRomaji(env.session, canonicalFor(task.key));
    expect(p.calls[0]).toBe('reject');
    expect(p.calls.at(-1)).toBe('finish:miss');
    expect(env.store.state.value.recent[task.key]?.[0]?.ok).toBe(false);
    env.scheduler.flush();
  });

  it('shows the romaji on Esc and counts it as an error', () => {
    const env = setup({ seed: 11 });
    toRecall(env);
    const task = env.session.task.value;
    if (task?.kind !== 'recall') throw new Error('not recall');
    show(env.session);
    env.session.handleIntent({ kind: 'reveal' });
    expect(env.session.notice.value).toEqual({
      kind: 'revealed',
      answer: canonicalFor(task.key),
    });
    typeRomaji(env.session, canonicalFor(task.key));
    expect(env.store.state.value.recent[task.key]?.[0]?.ok).toBe(false);
  });

  it('starts the task over when the tab was hidden, keeping an earlier error', () => {
    const env = setup({ seed: 11 });
    toRecall(env);
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
    const answer = env.store.state.value.recent[task.key]?.[0];
    expect(answer).toMatchObject({ ok: false, ms: 700 });
  });
});

describe('learning session: recognition', () => {
  function toRecognition(env: ReturnType<typeof setup>): void {
    env.session.start();
    for (let i = 0; i < 5; i++) answerRight(env);
    while (env.session.task.value?.kind !== 'recognition') answerRight(env);
  }

  it('offers four options and moves on after the pause when the choice is right', () => {
    const env = setup({ seed: 5 });
    toRecognition(env);
    const task = env.session.task.value;
    if (task?.kind !== 'recognition') throw new Error('not recognition');
    expect(task.options).toHaveLength(4);
    expect(task.options).toContain(task.key);
    show(env.session);
    env.session.choose(task.options.indexOf(task.key));
    expect(env.session.choice.value).toEqual({ chosen: task.key, correct: true });
    expect(env.session.phase.value).toBe('answered');
    env.scheduler.flush();
    expect(env.session.task.value).not.toBe(task);
  });

  it('records a wrong choice as a mixup and waits for a key or a click', () => {
    const env = setup({ seed: 5 });
    toRecognition(env);
    const task = env.session.task.value;
    if (task?.kind !== 'recognition') throw new Error('not recognition');
    show(env.session);
    const wrong = task.options.findIndex((option) => option !== task.key);
    const chosen = task.options[wrong];
    env.session.choose(wrong);
    expect(env.session.phase.value).toBe('waiting');
    expect(env.session.notice.value).toEqual({ kind: 'next' });
    expect(env.store.state.value.stats[task.key]?.mixups[chosen ?? keyOf('hiragana', 'あ')]).toBe(
      1,
    );
    // The timer does not move on by itself.
    env.scheduler.flush();
    expect(env.session.task.value).toBe(task);
    env.session.advance();
    expect(env.session.task.value).not.toBe(task);
  });

  it('ignores a second choice and an index with no option', () => {
    const env = setup({ seed: 5 });
    toRecognition(env);
    const task = env.session.task.value;
    if (task?.kind !== 'recognition') throw new Error('not recognition');
    show(env.session);
    env.session.choose(9);
    expect(env.session.choice.value).toBeNull();
    env.session.choose(task.options.indexOf(task.key));
    env.session.choose(0);
    expect(env.store.state.value.stats[task.key]?.recognitions).toBe(1);
  });
});

describe('learning session: leaving', () => {
  it('stops without a summary and keeps the recorded answers', () => {
    const env = setup();
    env.session.start();
    answerRight(env);
    env.session.leave();
    expect(env.session.phase.value).toBe('idle');
    expect(env.session.summary.value).toBeNull();
    expect(env.store.counters.value.finished.learn).toBe(0);
    expect(Object.keys(env.store.state.value.entries)).toHaveLength(1);
    // The pause timer is gone.
    env.scheduler.flush();
    expect(env.session.phase.value).toBe('idle');
  });
});

describe('learning session: determinism and leaving', () => {
  function record(env: ReturnType<typeof setup>): string[] {
    env.session.start();
    const seen: string[] = [];
    for (let i = 0; i < 25; i++) {
      const task = env.session.task.value;
      if (task === null) break;
      seen.push(
        `${task.kind}:${task.key}:${task.kind === 'recognition' ? task.options.join(',') : ''}`,
      );
      answerRight(env);
    }
    return seen;
  }

  it('gives the same tasks, kana and options for the same state and seed', () => {
    const first = record(setup({ seed: 7 }));
    const second = record(setup({ seed: 7 }));
    expect(first).toHaveLength(25);
    expect(second).toEqual(first);
  });

  it('keeps the summary when the screen leaves the session after its end', () => {
    const env = setup({ tasks: 1 });
    env.session.start();
    answerRight(env);
    expect(env.session.phase.value).toBe('summary');
    env.session.leave();
    expect(env.session.phase.value).toBe('summary');
    expect(env.session.summary.value).not.toBeNull();
  });
});
