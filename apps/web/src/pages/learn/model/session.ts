import { signal } from '@preact/signals';
import type { ReadonlySignal } from '@preact/signals';
import type {
  AudioProvider,
  Clock,
  LearnKanaKey,
  LearnState,
  Rng,
  Scheduler,
  TimeoutHandle,
  Track,
} from '@nekotype/shared/types';
import type { KeyIntent } from '@/shared/lib';
import { canonical, canonicalFor, compile, isComplete, start, step } from '@/entities/prompt';
import type { MatchState, Matcher, Strictness } from '@/entities/prompt';
import type { Keystroke, LearnStore } from '@/entities/learn';
import { ANSWER_PAUSE_MS, SESSION_TASKS } from '../lib/constants';
import { recognitionOptions } from '../lib/distractors';
import { summarize } from '../lib/summary';
import type { Mixup, SessionSummary } from '../lib/summary';
import { chooseTask } from '../lib/task-choice';

/** The part of the controller of a task that the session drives. */
export type TaskPort = {
  readonly setBuffer: (text: string) => void;
  readonly type: (count: number) => void;
  readonly reject: () => void;
  readonly finish: (result: 'correct' | 'miss') => void;
  readonly reset: () => void;
};

export type TaskView =
  | {
      readonly kind: 'introduction';
      readonly n: number;
      readonly key: LearnKanaKey;
      readonly kana: string;
      readonly romaji: string;
    }
  | {
      readonly kind: 'recall';
      readonly n: number;
      readonly key: LearnKanaKey;
      readonly kana: string;
    }
  | {
      readonly kind: 'recognition';
      readonly n: number;
      readonly key: LearnKanaKey;
      readonly romaji: string;
      readonly options: readonly LearnKanaKey[];
    };

export type Choice = { readonly chosen: LearnKanaKey; readonly correct: boolean };

/** What the notice line says; the screen words it. */
export type Notice =
  | { readonly kind: 'none' }
  | { readonly kind: 'revealed'; readonly answer: string }
  | { readonly kind: 'restarted' }
  | { readonly kind: 'next' };

/** `task`: waiting for the answer; `answered`: the result is held; `waiting`: for Enter, Space or a click. */
export type Phase = 'idle' | 'task' | 'answered' | 'waiting' | 'summary';

export type LearnSessionDeps = {
  readonly track: Track;
  readonly store: Pick<
    LearnStore,
    'state' | 'introduce' | 'recordRecall' | 'recordRecognition' | 'countSession'
  >;
  readonly clock: Clock;
  readonly scheduler: Scheduler;
  readonly rng: Rng;
  readonly audio: AudioProvider;
  /** Read at each task, so a change of the setting applies to the next one. */
  readonly strictness: () => Strictness;
  readonly targetMs: () => number;
  readonly tasks?: number;
};

export interface LearnSession {
  readonly task: ReadonlySignal<TaskView | null>;
  /** The answer to a recognition task; changes once, on the answer. */
  readonly choice: ReadonlySignal<Choice | null>;
  readonly notice: ReadonlySignal<Notice>;
  readonly phase: ReadonlySignal<Phase>;
  readonly summary: ReadonlySignal<SessionSummary | null>;
  readonly total: number;
  /** Shows the first task. */
  start: () => void;
  /** The task is on screen: its answer time runs from now, and keys are taken. */
  attach: (port: TaskPort) => void;
  handleIntent: (intent: KeyIntent) => void;
  /** Recall: shows the romaji (Esc, or the button on a touch screen); counts as an error. */
  reveal: () => void;
  /** Recognition: the option at `index` (0–3). */
  choose: (index: number) => void;
  /** After a wrong choice: on to the next task. */
  advance: () => void;
  /** The tab was hidden during a task: it starts over. */
  restart: () => void;
  /** Stops without a summary; every answer is already recorded. */
  leave: () => void;
}

function kanaOfKey(key: LearnKanaKey): string {
  return key.slice(key.indexOf(':') + 1);
}

/**
 * A learning session (docs/spec/learning.md, "Learning session"): 25 tasks, an introduction for
 * each unlocked kana not yet shown, then recall and recognition. It holds no DOM: the screen
 * hands it a `TaskPort` once a task is on display and calls `handleIntent`, `choose` and
 * `advance`. The signals change once per task (`task`) and once per recognition answer
 * (`choice`); a recall keystroke changes none of them.
 */
export function createLearnSession(deps: LearnSessionDeps): LearnSession {
  const { track, store, clock, scheduler, rng, audio } = deps;
  const total = deps.tasks ?? SESSION_TASKS;

  const task = signal<TaskView | null>(null);
  const choice = signal<Choice | null>(null);
  const notice = signal<Notice>({ kind: 'none' });
  const phase = signal<Phase>('idle');
  const summary = signal<SessionSummary | null>(null);

  let port: TaskPort | null = null;
  let count = 0;
  let previous: LearnKanaKey | null = null;
  let before: LearnState = store.state.value;
  let timer: TimeoutHandle | null = null;
  const mixups: Mixup[] = [];
  const errors = new Set<LearnKanaKey>();

  // The task on display.
  let matcher: Matcher | null = null;
  let matchState: MatchState | null = null;
  let typed = '';
  let keystrokes: Keystroke[] = [];
  let ok = true;
  let shownAt = 0;

  const clearTimer = (): void => {
    if (timer !== null) scheduler.clearTimeout(timer);
    timer = null;
  };

  const begin = (): void => {
    if (matcher === null) return;
    matchState = start(matcher);
    typed = '';
    keystrokes = [];
    shownAt = clock.now();
  };

  const finish = (): void => {
    clearTimer();
    store.countSession('finished');
    summary.value = summarize({
      track,
      before,
      after: store.state.value,
      targetMs: deps.targetMs(),
      mixups,
      errors: [...errors],
    });
    phase.value = 'summary';
  };

  const pick = (): { kind: TaskView['kind']; key: LearnKanaKey } | null => {
    const state = store.state.value;
    const pending = state.unlocked[track].find((key) => state.entries[key] === undefined);
    if (pending !== undefined) return { kind: 'introduction', key: pending };
    return chooseTask({
      track,
      state,
      targetMs: deps.targetMs(),
      previous,
      rng,
    });
  };

  const showNext = (): void => {
    clearTimer();
    const next = count >= total ? null : pick();
    if (next === null) {
      finish();
      return;
    }
    count += 1;
    previous = next.key;
    port = null;
    matcher = null;
    matchState = null;
    ok = true;
    const n = count;
    const { key } = next;
    const kana = kanaOfKey(key);
    if (next.kind === 'recognition') {
      const state = store.state.value;
      matcher = null;
      task.value = {
        kind: 'recognition',
        n,
        key,
        romaji: canonicalFor(key),
        options: recognitionOptions({
          track,
          answer: key,
          unlocked: state.unlocked[track],
          stat: state.stats[key],
          strictness: deps.strictness(),
          rng,
        }),
      };
    } else {
      matcher = compile([{ key, text: kana }], deps.strictness());
      task.value =
        next.kind === 'introduction'
          ? { kind: 'introduction', n, key, kana, romaji: canonicalFor(key) }
          : { kind: 'recall', n, key, kana };
    }
    choice.value = null;
    notice.value = { kind: 'none' };
    phase.value = 'task';
  };

  const hold = (): void => {
    phase.value = 'answered';
    clearTimer();
    timer = scheduler.setTimeout(showNext, ANSWER_PAUSE_MS);
  };

  const completeTyped = (current: TaskView): void => {
    if (current.kind === 'introduction') {
      port?.finish('correct');
      store.introduce(current.key);
    } else if (current.kind === 'recall') {
      store.recordRecall({ key: current.key, keystrokes, ok });
      if (!ok) errors.add(current.key);
      port?.finish(ok ? 'correct' : 'miss');
    }
    audio.play(current.key);
    hold();
  };

  const typeChar = (current: TaskView, char: string): void => {
    if (matcher === null || matchState === null || port === null) return;
    const t = clock.now() - shownAt;
    const next = step(matcher, matchState, char);
    if (next === null) {
      if (current.kind === 'recall') {
        keystrokes.push({ t, accepted: false });
        ok = false;
      }
      port.reject();
      return;
    }
    matchState = next;
    typed += char;
    if (current.kind === 'recall') {
      keystrokes.push({ t, accepted: true });
      port.setBuffer(typed);
    } else if (current.kind === 'introduction') {
      port.type(Math.min(typed.length, current.romaji.length));
    }
    if (isComplete(matcher, next)) completeTyped(current);
  };

  const reveal = (): void => {
    const current = task.value;
    if (current === null || current.kind !== 'recall') return;
    if (phase.value !== 'task' || port === null || matcher === null) return;
    keystrokes.push({ t: clock.now() - shownAt, accepted: false });
    ok = false;
    notice.value = { kind: 'revealed', answer: canonical(matcher, 0) };
  };

  return {
    task,
    choice,
    notice,
    phase,
    summary,
    total,

    start() {
      before = store.state.value;
      count = 0;
      previous = null;
      store.countSession('started');
      showNext();
    },

    attach(next) {
      port = next;
      begin();
    },

    handleIntent(intent) {
      const current = task.value;
      if (current === null || phase.value !== 'task' || port === null) return;
      if (intent.kind === 'reveal') reveal();
      else if (intent.kind === 'char' && current.kind !== 'recognition') {
        typeChar(current, intent.char);
      }
    },

    reveal,

    choose(index) {
      const current = task.value;
      if (current === null || current.kind !== 'recognition') return;
      if (phase.value !== 'task' || port === null) return;
      const chosen = current.options[index];
      if (chosen === undefined) return;
      const correct = chosen === current.key;
      store.recordRecognition({ key: current.key, chosen });
      audio.play(current.key);
      if (!correct) {
        if (!mixups.some((m) => m.key === current.key && m.chosen === chosen)) {
          mixups.push({ key: current.key, chosen });
        }
        notice.value = { kind: 'next' };
        phase.value = 'waiting';
        choice.value = { chosen, correct };
        return;
      }
      phase.value = 'answered';
      choice.value = { chosen, correct };
      hold();
    },

    advance() {
      if (phase.value === 'waiting') showNext();
    },

    restart() {
      const current = task.value;
      if (current === null || phase.value !== 'task' || port === null) return;
      if (current.kind === 'recognition') return;
      begin();
      port.reset();
      notice.value = { kind: 'restarted' };
    },

    leave() {
      clearTimer();
      port = null;
      phase.value = 'idle';
    },
  };
}
