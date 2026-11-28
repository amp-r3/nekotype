import { signal } from '@preact/signals';
import type { ReadonlySignal } from '@preact/signals';
import { nextTask } from '@nekotype/model';
import { MISSES_MAX } from '@nekotype/shared/runtime';
import type { LearnView, ModelState } from '@nekotype/model';
import type {
  AudioProvider,
  Clock,
  LearnKanaKey,
  Rng,
  Scheduler,
  TimeoutHandle,
  Track,
} from '@nekotype/shared/types';
import type { KeyIntent } from '@/shared/lib';
import { requestSync } from '@/shared/lib';
import { compile, isComplete, start, step } from '../lib/prompt';
import type { MatchState, Matcher, Strictness } from '../lib/prompt';
import { displayRomaji, trackOfKey } from '@/entities/learn';
import type { AnswerInput, Keystroke, ShownForecast } from '@/entities/learn';
import { ANSWER_PAUSE_MS, SESSION_TASKS } from '../lib/constants';
import { recognitionOptions } from '../lib/distractors';
import { summarize } from '../lib/summary';
import type { Mixup, SessionSummary } from '../lib/summary';
import { wrongKana } from '../lib/wrong-kana';

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

/** What the session needs of the learn store (`entities/learn`). */
export type SessionStore = {
  readonly view: ReadonlySignal<LearnView | null>;
  readonly modelState: () => ModelState | null;
  readonly startSession: () => void;
  readonly endSession: () => void;
  readonly introduce: (key: LearnKanaKey) => void;
  readonly recordAnswer: (input: AnswerInput) => void;
};

export type LearnSessionDeps = {
  /** `settings.learn.track`: where the planner takes new kana from. */
  readonly track: Track;
  readonly store: SessionStore;
  readonly clock: Clock;
  readonly scheduler: Scheduler;
  readonly rng: Rng;
  readonly audio: AudioProvider;
  /** Read at each task, so a change of the setting applies to the next one. */
  readonly strictness: () => Strictness;
  readonly tasks?: number;
  /**
   * The forecast shown for the session's track when it starts, or null when none was ready: the
   * summary compares it with the one after the session (P8 plan, D9). Read once, in `start()`.
   */
  readonly forecastBefore?: () => ShownForecast | null;
};

export interface LearnSession {
  readonly task: ReadonlySignal<TaskView | null>;
  /** The answer to a recognition task; changes once, on the answer. */
  readonly choice: ReadonlySignal<Choice | null>;
  readonly notice: ReadonlySignal<Notice>;
  readonly phase: ReadonlySignal<Phase>;
  readonly summary: ReadonlySignal<SessionSummary | null>;
  /**
   * The 0-based numbers of the finished tasks answered with an error (a rejected key or Esc in
   * recall, a wrong choice in recognition): the ticks under the session line (design 149). It
   * grows when the answer is recorded, never in the key handler of a recall.
   */
  readonly misses: ReadonlySignal<readonly number[]>;
  /** The track the session plans from. */
  readonly track: Track;
  /** The forecast of the session's track when it started; null when none was ready. */
  readonly forecastBefore: ShownForecast | null;
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

/** The kana of a track that are not locked, for the filler of the options. */
function introducedOf(view: LearnView | null, track: Track): readonly LearnKanaKey[] {
  if (view === null) return [];
  const keys: LearnKanaKey[] = [];
  for (const [key, kana] of view.kana) {
    if (kana.state !== 'locked' && trackOfKey(key) === track) keys.push(key);
  }
  return keys;
}

/**
 * A learning session (docs/spec/learning.md, "Learning session"): 30 tasks, each chosen by the
 * planner of the model when it is shown (introduction, recall or recognition). It holds no DOM: the screen
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
  const misses = signal<readonly number[]>([]);
  let forecastBefore: ShownForecast | null = null;

  let port: TaskPort | null = null;
  let count = 0;
  let previous: LearnKanaKey | null = null;
  let before: LearnView | null = store.view.value;
  let timer: TimeoutHandle | null = null;
  const mixups: Mixup[] = [];
  const errors = new Set<LearnKanaKey>();

  // The task on display.
  let matcher: Matcher | null = null;
  let matchState: MatchState | null = null;
  let typed = '';
  let keystrokes: Keystroke[] = [];
  let ok = true;
  /** Keys of a recall rejected so far, at most `MISSES_MAX`. */
  let rejected = 0;
  /** The romaji of the recall was shown (Esc or the button): a `hint` in the log. */
  let revealed = false;
  /** The romaji typed up to and including the first rejected key of a recall; null for none. */
  let firstError: string | null = null;
  let shownAt = 0;

  const clearTimer = (): void => {
    if (timer !== null) scheduler.clearTimeout(timer);
    timer = null;
  };

  const begin = (): void => {
    matchState = matcher === null ? null : start(matcher);
    typed = '';
    keystrokes = [];
    shownAt = clock.now();
  };

  const finish = (): void => {
    clearTimer();
    store.endSession();
    requestSync();
    const after = store.view.value;
    if (before !== null && after !== null) {
      summary.value = summarize({ before, after, mixups, errors: [...errors] });
    } else {
      summary.value = {
        introduced: [],
        learned: [],
        faster: [],
        slower: [],
        mixups,
        errors: [...errors],
        states: new Map(),
      };
    }
    phase.value = 'summary';
  };

  // The planner runs here, when a task is shown, never in a key handler (D18).
  const pick = (): { kind: TaskView['kind']; key: LearnKanaKey } | null => {
    const state = store.modelState();
    if (state === null) return null;
    const task = nextTask(state, { now: clock.now(), track, previous, rng });
    return task === null ? null : { kind: task.kind, key: task.key };
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
    rejected = 0;
    revealed = false;
    firstError = null;
    const n = count;
    const { key } = next;
    const kana = kanaOfKey(key);
    if (next.kind === 'recognition') {
      const shown = store.view.value;
      const own = trackOfKey(key);
      matcher = null;
      task.value = {
        kind: 'recognition',
        n,
        key,
        romaji: displayRomaji(key),
        options: recognitionOptions({
          track: own,
          answer: key,
          introduced: introducedOf(shown, own),
          confusions: shown?.kana.get(key)?.confusions ?? [],
          strictness: deps.strictness(),
          rng,
        }),
      };
    } else {
      // An introduction takes only the romaji it shows, so only recall needs the matcher.
      matcher = next.kind === 'recall' ? compile([{ key, text: kana }], deps.strictness()) : null;
      task.value =
        next.kind === 'introduction'
          ? { kind: 'introduction', n, key, kana, romaji: displayRomaji(key) }
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

  // The record is deferred: a key handler does no fold, grade or IndexedDB call (D18). It runs
  // before the hold timer, so the next task is planned on the answer.
  const defer = (record: () => void): void => {
    scheduler.setTimeout(record, 0);
  };

  const completeTyped = (current: TaskView): void => {
    const { key } = current;
    if (current.kind === 'introduction') {
      port?.finish('correct');
      defer(() => {
        store.introduce(key);
      });
    } else if (current.kind === 'recall') {
      const answered = { keystrokes: [...keystrokes], ok, rejected, revealed, firstError };
      const strictness = deps.strictness();
      if (!ok) errors.add(key);
      const index = count - 1;
      port?.finish(ok ? 'correct' : 'miss');
      defer(() => {
        if (!answered.ok) misses.value = [...misses.value, index];
        store.recordAnswer({
          task: 'recall',
          key,
          ok: answered.ok,
          keystrokes: answered.keystrokes,
          hint: answered.revealed,
          misses: answered.rejected,
          // The kana the typed romaji matched is worked out here, not in the key handler (D18).
          wrong:
            answered.firstError === null
              ? null
              : wrongKana(trackOfKey(key), strictness, answered.firstError),
          alt: null,
        });
      });
    }
    audio.play(key);
    hold();
  };

  // An introduction takes only the romaji it shows (ADR 062): another spelling of the kana is a
  // rejected key, so the ghost hint and the typed letters always agree. Nothing is recorded.
  const typeIntroduction = (current: TaskView & { kind: 'introduction' }, char: string): void => {
    if (port === null) return;
    if (current.romaji[typed.length] !== char) {
      port.reject();
      return;
    }
    typed += char;
    port.type(typed.length);
    if (typed.length === current.romaji.length) completeTyped(current);
  };

  const typeChar = (current: TaskView, char: string): void => {
    if (current.kind === 'introduction') {
      typeIntroduction(current, char);
      return;
    }
    if (matcher === null || matchState === null || port === null) return;
    const t = clock.now() - shownAt;
    const next = step(matcher, matchState, char);
    if (next === null) {
      if (current.kind === 'recall') {
        keystrokes.push({ t, accepted: false });
        // Only the first error names a kana: the prefix typed so far plus this key.
        if (ok) firstError = typed + char;
        ok = false;
        rejected = Math.min(MISSES_MAX, rejected + 1);
      }
      port.reject();
      return;
    }
    matchState = next;
    typed += char;
    keystrokes.push({ t, accepted: true });
    port.setBuffer(typed);
    if (isComplete(matcher, next)) completeTyped(current);
  };

  const reveal = (): void => {
    const current = task.value;
    if (current === null || current.kind !== 'recall') return;
    if (phase.value !== 'task' || port === null || matcher === null) return;
    keystrokes.push({ t: clock.now() - shownAt, accepted: false });
    ok = false;
    revealed = true;
    notice.value = { kind: 'revealed', answer: displayRomaji(current.key) };
  };

  return {
    task,
    choice,
    notice,
    phase,
    summary,
    misses,
    track,
    get forecastBefore() {
      return forecastBefore;
    },
    total,

    start() {
      before = store.view.value;
      // Read before `startSession`, which drops the insights request (D8).
      forecastBefore = deps.forecastBefore?.() ?? null;
      count = 0;
      previous = null;
      misses.value = [];
      store.startSession();
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
      const ms = clock.now() - shownAt;
      const { key } = current;
      defer(() => {
        store.recordAnswer({
          task: 'recognition',
          key,
          ok: correct,
          ms,
          hint: false,
          wrong: correct ? null : chosen,
          alt: null,
          misses: 0,
        });
      });
      audio.play(current.key);
      if (!correct) {
        if (!mixups.some((m) => m.key === current.key && m.chosen === chosen)) {
          mixups.push({ key: current.key, chosen });
        }
        // The choice renders the screen anyway, so the tick turns with it.
        misses.value = [...misses.value, count - 1];
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
      // The summary is kept: leaving after the end must not wipe it.
      if (phase.value === 'summary') return;
      clearTimer();
      port = null;
      phase.value = 'idle';
    },
  };
}
