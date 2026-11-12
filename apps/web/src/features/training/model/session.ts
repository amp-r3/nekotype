import type { ReadonlySignal } from '@preact/signals';
import { batch, computed, signal } from '@preact/signals';
import type { KeyIntent } from '@/shared/lib';
import { computeMetrics } from '../lib/metrics';
import { createKeyTally } from '../lib/key-tally';
import type { EndedTest, Phase, PromptResult, SessionMetrics } from './types';
import {
  AHEAD_TOKENS,
  EMPTY_STREAM,
  HARD_BEHIND_TOKENS,
  MAX_WINDOW_PROMPTS,
  shouldPublish,
  staleCount,
  streamPromptsOf,
} from './stream';
import type { Mistake, StreamPrompt, StreamSnapshot } from './stream';
import type {
  EngineView,
  ErrorLog,
  MatchState,
  Matcher,
  PromptItem,
  Strictness,
  TokenTiming,
} from '@/entities/prompt';
import {
  canonical,
  committedPrompts,
  committedTimings,
  compact,
  compile,
  createErrorLog,
  errorTarget,
  extend,
  isComplete,
  settledPrompts,
  start,
  step,
  view,
} from '@/entities/prompt';
import type { TestConfig } from '@/entities/settings';
import type { Clock, Scheduler, TimeoutHandle } from '@/shared/lib';
import { defaultClock, defaultScheduler } from '@/shared/lib';

// Committed prompts after which the matcher drops them (spec "Window").
const COMPACT_EVERY = 20;

// A live indicator stays at 0 until this much of the test has passed, so the first keys do not
// show a figure that is only noise.
const MIN_LIVE_MS = 1000;

export type SessionDeps = {
  readonly nextPrompt: () => PromptItem;
  // Read once per prompt loaded (`loadPrompt`), so a settings change takes effect on the next test.
  readonly config: () => TestConfig;
  // Called once when a test ends and is to be kept (`complete` or `manual`). The session holds no
  // store of its own (D17): the trainer turns the report into a saved result.
  readonly onEnd?: (ended: EndedTest) => void;
  readonly clock?: Clock;
  readonly scheduler?: Scheduler;
  // While true, keys are ignored: the prompts to type are still loading.
  readonly inputBlocked?: () => boolean;
  // Called when a test is ended by hand with nothing to keep (no prompt completed, or no time
  // passed): it is dropped like a restart, and this starts the next one. Defaults to `reset()`.
  readonly onDiscard?: () => void;
};

/** What a view may read and call. Everything a session holds is private to this instance (D17). */
export type Session = {
  readonly isAssisted: ReadonlySignal<boolean>;
  readonly currentPrompt: ReadonlySignal<PromptItem | null>;
  readonly canonicalRomaji: ReadonlySignal<string>;
  readonly tickerNow: ReadonlySignal<number>;
  readonly phase: ReadonlySignal<Phase>;
  readonly metrics: ReadonlySignal<SessionMetrics | null>;
  readonly promptResults: ReadonlySignal<readonly PromptResult[]>;
  // Prompts completed so far, as a test ending now would count them: every prompt before the one on
  // screen (metrics.md, "Test end"). The live counter reads it; `promptResults` lags behind it.
  readonly completedPrompts: ReadonlySignal<number>;
  readonly correctKeystrokes: ReadonlySignal<number>;
  readonly sessionStartedAt: ReadonlySignal<number>;
  // Committed tokens per minute and kana accuracy in percent, for the live strip (metrics.md).
  readonly liveKpm: ReadonlySignal<number>;
  readonly liveAccuracy: ReadonlySignal<number>;
  // The text stream (frontend.md). `stream` lists the prompts to draw. It changes only when the view
  // needs a new window, when the tokens ahead run low or the ones behind pile up (stream.ts): never
  // on a keystroke inside a prompt, and not at every completed prompt either. The rest changes on a
  // keystroke and is meant to be written to the DOM without a render: `caret` is the number of the token the caret stands
  // before, `romajiBuffer` the Latin typed beyond it, `mistake` the latest wrong key or hint.
  // Token numbers count from the start of the test and survive `compact()`.
  readonly stream: ReadonlySignal<StreamSnapshot>;
  readonly caret: ReadonlySignal<number>;
  readonly romajiBuffer: ReadonlySignal<string>;
  readonly mistake: ReadonlySignal<Mistake | null>;
  // Tokens of the stream that have been charged an error (D11); read to paint a stream afresh.
  erroredTokens(): ReadonlySet<number>;
  // The view reports the first token (absolute) of the line above the caret: what is before it can
  // leave the stream without changing how the rest wraps (stream.ts). A view with no layout never
  // calls it, and only the cap on the window applies.
  setTrimPoint(token: number): void;
  loadPrompt(prompt: PromptItem, strictness: Strictness): void;
  handleIntent(intent: KeyIntent): void;
  // Ends a zen test by hand (the Finish button, Ctrl/Cmd+Enter). It keeps the test when a prompt is
  // completed and time has passed, and drops it like a restart otherwise (metrics.md, "Test end").
  // Any other kind of test, and a test that has not started, ignore it.
  finish(): void;
  /** Whether `finish()` would end the test now: a zen test that is running. */
  canFinish(): boolean;
  reset(): void;
};

export function createSession(deps: SessionDeps): Session {
  return new TrainingSession(
    deps.nextPrompt,
    deps.config,
    deps.clock ?? defaultClock,
    deps.scheduler ?? defaultScheduler,
    deps.onDiscard,
    deps.inputBlocked,
    deps.onEnd,
  );
}

/**
 * Types a stream of prompts. The matcher holds a window of the displayed prompt and the next ones;
 * the next prompt is displayed as soon as the live conversion reaches the end of the current one,
 * and a result is recorded when `settledPrompts()` includes the prompt, or at the test's end for every
 * prompt before the displayed one (spec D3, A15, metrics.md "Test end").
 *
 * Prompts are numbered from the start of the test ("absolute"); the matcher numbers them from the
 * first prompt of its window ("local"), which moves when `compact()` drops committed prompts.
 */
class TrainingSession implements Session {
  private readonly _isAssisted = signal<boolean>(false);
  private readonly _currentPrompt = signal<PromptItem | null>(null);
  private readonly _canonicalRomaji = signal<string>('');
  private readonly _tickerNow = signal<number>(0);
  private readonly _phase = signal<Phase>('idle');
  private readonly _metrics = signal<SessionMetrics | null>(null);
  // The results of the recorded prompts. They grow by one per prompt to the end of the test (O(n),
  // ADR 050); `promptResults` copies them only when something reads it.
  private results: PromptResult[] = [];
  private readonly resultsMark = signal<{ list: PromptResult[]; count: number }>({
    list: this.results,
    count: 0,
  });
  private readonly _completedPrompts = signal<number>(0);
  private readonly _correctKeystrokes = signal<number>(0);
  private readonly _sessionStartedAt = signal<number>(0);
  private readonly _stream = signal<StreamSnapshot>(EMPTY_STREAM);
  private readonly _caret = signal<number>(0);
  private readonly _romajiBuffer = signal<string>('');
  private readonly _mistake = signal<Mistake | null>(null);
  private readonly _committedTokens = signal<number>(0);
  private readonly _erroredTokens = signal<number>(0);
  // Committed tokens per kana, and those of them that were errored (T4); the report's `kanaDelta`.
  private readonly kanaCounts = new Map<string, { attempts: number; erroredAttempts: number }>();
  // Hints (Esc) over the whole test; `assisted` forgets prompts that compaction dropped.
  private hints = 0;
  private strictness: Strictness = 'learner';

  readonly isAssisted: ReadonlySignal<boolean> = this._isAssisted;
  readonly currentPrompt: ReadonlySignal<PromptItem | null> = this._currentPrompt;
  readonly canonicalRomaji: ReadonlySignal<string> = this._canonicalRomaji;
  readonly tickerNow: ReadonlySignal<number> = this._tickerNow;
  readonly phase: ReadonlySignal<Phase> = this._phase;
  readonly metrics: ReadonlySignal<SessionMetrics | null> = this._metrics;
  readonly promptResults: ReadonlySignal<readonly PromptResult[]> = computed(() => {
    // The copy is made only when a reader asks and the results changed.
    const { list, count } = this.resultsMark.value;
    return list.slice(0, count);
  });
  readonly completedPrompts: ReadonlySignal<number> = this._completedPrompts;
  readonly correctKeystrokes: ReadonlySignal<number> = this._correctKeystrokes;
  readonly sessionStartedAt: ReadonlySignal<number> = this._sessionStartedAt;

  readonly stream: ReadonlySignal<StreamSnapshot> = this._stream;
  readonly caret: ReadonlySignal<number> = this._caret;
  readonly romajiBuffer: ReadonlySignal<string> = this._romajiBuffer;
  readonly mistake: ReadonlySignal<Mistake | null> = this._mistake;

  readonly liveKpm: ReadonlySignal<number> = computed(() => {
    const startedAt = this._sessionStartedAt.value;
    const elapsed = this._tickerNow.value - startedAt;
    if (startedAt === 0 || elapsed < MIN_LIVE_MS) return 0;
    return Math.round(this._committedTokens.value / (elapsed / 60000));
  });

  readonly liveAccuracy: ReadonlySignal<number> = computed(() => {
    const committed = this._committedTokens.value;
    if (committed === 0) return 100;
    return Math.round(((committed - this._erroredTokens.value) / committed) * 100);
  });

  private matcher: Matcher | null = null;
  private matchState: MatchState | null = null;

  private readonly keyTally = createKeyTally();
  // The prompts drawn in the stream, which outlive their tokens in the matcher: the matcher drops
  // committed prompts, the stream keeps the line just typed on screen.
  private streamPrompts: StreamPrompt[] = [];
  // The first token of the line above the caret, as the view last reported it; 0 until it does.
  private trimBefore = 0;
  // Number, from the start of the test, of the matcher's first token; compact() raises it.
  private tokenBase = 0;
  private readonly erroredAbs = new Set<number>();
  private mistakeSeq = 0;
  // Index in the matcher's tokens up to which committed tokens are counted for the live strip.
  private committedPtr = 0;

  // The prompts of the matcher's window, in order.
  private prompts: PromptItem[] = [];
  // Absolute number of the first prompt of the window.
  private promptBase = 0;
  // Absolute number of the prompt on screen.
  private displayed = 0;
  // Absolute count of prompts whose result is recorded.
  private recorded = 0;
  // Absolute count of prompts seen as committed, and when each one was.
  private committedSeen = 0;
  private readonly committedAt = new Map<number, number>();
  private readonly assisted = new Set<number>();
  private errorLog: ErrorLog = createErrorLog();
  // Time of the accepted keystrokes still needed, from the one numbered `keyBase` (the engine's
  // keystroke indices count from the start of the test; compact() lets the older ones go).
  private keyTimes: number[] = [];
  private keyBase = 0;
  // When the last recorded token ended; undefined until one is recorded.
  private lastTokenEnd: number | undefined = undefined;
  // The test config as it stood when the prompt was loaded; the test runs by it to its end.
  private testConfig: TestConfig;

  private deadlineTimeoutHandle: TimeoutHandle | null = null;
  private tickerIntervalHandle: TimeoutHandle | null = null;

  constructor(
    private readonly nextPrompt: () => PromptItem,
    private readonly config: () => TestConfig,
    private readonly clock: Clock,
    private readonly scheduler: Scheduler,
    private readonly onDiscard: (() => void) | undefined,
    private readonly inputBlocked: (() => boolean) | undefined,
    private readonly onEnd: ((ended: EndedTest) => void) | undefined,
  ) {
    this.testConfig = config();
  }

  loadPrompt(prompt: PromptItem, strictness: Strictness): void {
    this.prompts = [prompt];
    this.promptBase = 0;
    this.displayed = 0;
    this.recorded = 0;
    this.committedSeen = 0;
    this.committedAt.clear();
    this.assisted.clear();
    this.hints = 0;
    this.errorLog = createErrorLog();
    this.keyTimes = [];
    this.keyBase = 0;
    this.lastTokenEnd = undefined;
    this.testConfig = this.config();
    this.strictness = strictness;
    this.committedPtr = 0;
    this.tokenBase = 0;
    this.streamPrompts = [];
    this.trimBefore = 0;
    this.erroredAbs.clear();
    const matcher = compile([prompt], strictness);
    const state = start(matcher);
    this.matcher = matcher;
    this.matchState = state;
    this.streamPrompts = streamPromptsOf(matcher, 0, this.promptBase, this.tokenBase);
    this._mistake.value = null;
    // A stream of the old prompts may still stand: publish this one whatever shouldPublish says.
    this._stream.value = EMPTY_STREAM;
    this.fillWindow();
    const v = view(matcher, state);
    this.showPrompt(v);
    this.updateCaret(v);
  }

  handleIntent(intent: KeyIntent): void {
    if (this._phase.value === 'finished' || intent.kind === 'ignore' || this.inputBlocked?.()) {
      return;
    }
    if (intent.kind === 'finish') {
      this.finish();
      return;
    }
    const matcher = this.matcher;
    const state = this.matchState;
    if (matcher === null || state === null) {
      return;
    }

    const now = this.clock.now();

    // Reveal intent (Esc): counts one mistake, the prompt must still be typed in full
    if (intent.kind === 'reveal') {
      if (!this.assisted.has(this.displayed)) {
        this.assisted.add(this.displayed);
        this.hints += 1;
        this._isAssisted.value = true;
        const target = errorTarget(matcher, state);
        this.errorLog.record(target, null, '');
        this.noteMistake(target, 'hint');
      }
      return;
    }

    // First typed letter starts the test if idle
    if (this._phase.value === 'idle') {
      this.beginTest(now);
    }

    // One batch per keystroke: a reader of several signals sees them in step.
    batch(() => {
      const next = step(matcher, state, intent.char);
      if (next === null) {
        this.reject(matcher, state, intent.char, now);
        return;
      }

      this.keyTally.record(now, true);
      this._correctKeystrokes.value += 1;
      this.keyTimes.push(now);
      this.matchState = next;
      this.afterAccepted(matcher, next, now);
    });
  }

  private finishSession(endReason: EndedTest['endReason']): void {
    if (this._phase.value !== 'running') return;
    if (this.matcher !== null && this.matchState !== null) {
      // Every prompt before the one on screen is completed, a final ん of it included (metrics.md).
      this.flushResults(this.displayed);
    }
    this.clearTimers();
    const endedAt = this.clock.now();
    this.finishTest(endedAt);
    this.report(endReason, endedAt);
  }

  // The report to the trainer, of the test that just ended (T4).
  private report(endReason: EndedTest['endReason'], endedAt: number): void {
    const kanaDelta: Record<string, { attempts: number; erroredAttempts: number }> = {};
    for (const [key, count] of this.kanaCounts) kanaDelta[key] = { ...count };
    const startedAt = this._sessionStartedAt.peek();
    const { correct, rejected } = this.keyTally.snapshot;
    this.onEnd?.({
      endReason,
      config: this.testConfig,
      strictness: this.strictness,
      startedAt,
      endedAt,
      durationMs: Math.max(0, endedAt - startedAt),
      tokens: this._committedTokens.peek(),
      erroredTokens: this._erroredTokens.peek(),
      items: this.recorded,
      keystrokes: correct + rejected,
      rejectedKeystrokes: rejected,
      assisted: this.hints,
      kanaDelta,
    });
  }

  canFinish(): boolean {
    return (
      this.testConfig.kind === 'zen' &&
      this._phase.value === 'running' &&
      this.matcher !== null &&
      this.matchState !== null &&
      !this.inputBlocked?.()
    );
  }

  finish(): void {
    const matcher = this.matcher;
    const state = this.matchState;
    if (this.testConfig.kind !== 'zen' || this._phase.value !== 'running') return;
    if (matcher === null || state === null) return;

    const now = this.clock.now();
    const completed = this.displayed;
    const elapsed = now - (this.keyTally.snapshot.firstAt ?? now);
    if (completed >= 1 && elapsed > 0) {
      this.finishSession('manual');
      return;
    }
    // Nothing worth keeping: back to a new test, without a results screen.
    this.clearTimers();
    if (this.onDiscard) {
      this.onDiscard();
    } else {
      this.reset();
    }
  }

  reset(): void {
    this.clearTimers();
    this.matcher = null;
    this.matchState = null;
    this.prompts = [];
    this.keyTimes = [];
    this.keyBase = 0;
    this.committedAt.clear();
    this.assisted.clear();
    this.hints = 0;
    this._isAssisted.value = false;
    this._canonicalRomaji.value = '';
    this.streamPrompts = [];
    this.trimBefore = 0;
    this.tokenBase = 0;
    this.erroredAbs.clear();
    this._stream.value = EMPTY_STREAM;
    this._caret.value = 0;
    this._romajiBuffer.value = '';
    this._mistake.value = null;
    this.resetState();
  }

  erroredTokens(): ReadonlySet<number> {
    return this.erroredAbs;
  }

  setTrimPoint(token: number): void {
    this.trimBefore = token;
  }

  private beginTest(now: number): void {
    this.resetState();
    this._phase.value = 'running';
    this._sessionStartedAt.value = now;

    // If time test, arm deadline timer
    const config = this.testConfig;
    if (config.kind === 'time') {
      this.deadlineTimeoutHandle = this.scheduler.setTimeout(() => {
        this.finishSession('complete');
      }, config.seconds * 1000);
    }

    // 1 Hz ticker for live stats
    this._tickerNow.value = now;
    this.tickerIntervalHandle = this.scheduler.setInterval(() => {
      this._tickerNow.value = this.clock.now();
    }, 1000);
  }

  // Rejected: the view flashes the caret (`mistake`), and the key is charged to errorTarget() (D10, A34).
  private reject(matcher: Matcher, state: MatchState, char: string, now: number): void {
    this.keyTally.record(now, false);
    const target = errorTarget(matcher, state);
    this.errorLog.record(target, matcher.tokens[target]?.kanaKey ?? null, char);
    this.noteMistake(target, 'rejected');
  }

  private afterAccepted(matcher: Matcher, state: MatchState, now: number): void {
    const localCommitted = committedPrompts(matcher, state);
    const committed = this.promptBase + localCommitted;
    for (let k = this.committedSeen; k < committed; k++) {
      this.committedAt.set(k, now);
    }
    this.committedSeen = Math.max(this.committedSeen, committed);
    // Settled prompts only: a ん resolved by the next prompt's first key is not inflated.
    if (this.recorded < committed) {
      this.flushResults(this.promptBase + settledPrompts(matcher, state));
    }

    // Live strip: tokens before the earliest active token are committed in every position.
    const v = view(matcher, state);
    this.advanceCommitted(matcher, v.activeToken);
    this.updateCaret(v);
    this._tickerNow.value = now;

    // The last prompt of a count test ends it as soon as the stream is complete.
    if (this.isFinalStream() && isComplete(matcher, state)) {
      this.flushResults(this.promptBase + this.prompts.length);
      this._completedPrompts.value = this.recorded;
      // Every token is committed now, whatever the engine still holds open.
      this.advanceCommitted(matcher, matcher.tokens.length);
      this.finishSession('complete');
      return;
    }

    // Move to the next prompt when the live conversion has reached it.
    const last = matcher.tokens.length - 1;
    const local = matcher.tokens[Math.min(v.displayedTokens, last)]?.promptIndex ?? 0;
    if (this.promptBase + local > this.displayed) {
      this.displayed = this.promptBase + local;
      this.fillWindow();
      this.showPrompt(v);
    }

    this.compactIfDue(localCommitted);
  }

  // Counts the non-skip tokens that became committed, and those of them that were errored, once
  // each. Tokens before `upTo` cannot change any more: the earliest active position has passed them.
  private advanceCommitted(matcher: Matcher, upTo: number): void {
    if (upTo <= this.committedPtr) return;
    let committed = 0;
    let errored = 0;
    for (let t = this.committedPtr; t < upTo; t++) {
      const token = matcher.tokens[t];
      if (token?.kind === 'skip') continue;
      committed += 1;
      const wrong = this.errorLog.errored(t);
      if (wrong) errored += 1;
      if (token?.kanaKey) {
        const count = this.kanaCounts.get(token.kanaKey) ?? { attempts: 0, erroredAttempts: 0 };
        count.attempts += 1;
        if (wrong) count.erroredAttempts += 1;
        this.kanaCounts.set(token.kanaKey, count);
      }
    }
    this.committedPtr = upTo;
    this._committedTokens.value += committed;
    this._erroredTokens.value += errored;
  }

  private finishTest(endTimeMs: number): void {
    this._phase.value = 'finished';
    this._metrics.value = computeMetrics(this.keyTally.snapshot, this.results, endTimeMs);
  }

  private resetState(): void {
    this._phase.value = 'idle';
    this._sessionStartedAt.value = 0;
    this._correctKeystrokes.value = 0;
    this._committedTokens.value = 0;
    this._erroredTokens.value = 0;
    this.kanaCounts.clear();
    this.results = [];
    this.resultsMark.value = { list: this.results, count: 0 };
    this._completedPrompts.value = 0;
    this._metrics.value = null;
    this.keyTally.reset();
    this.committedPtr = 0;
  }

  private promptLimit(): number {
    const config = this.testConfig;
    return config.kind === 'count' ? config.prompts : Number.POSITIVE_INFINITY;
  }

  private isFinalStream(): boolean {
    return this.promptBase + this.prompts.length >= this.promptLimit();
  }

  // Keeps the displayed prompt and, after it, enough prompts to fill the lines of the stream
  // (AHEAD_TOKENS), up to the end of a count test. They all stand in the matcher, so the context of
  // a non-final ん is known long before it is typed (spec "Window"), and the stream draws tokens the
  // matcher has already cut. They are asked for in batches sized by the prompts seen so far.
  private fillWindow(): void {
    for (;;) {
      const matcher = this.matcher;
      if (matcher === null) return;
      const have = this.promptBase + this.prompts.length;
      const limit = this.promptLimit();
      if (have >= limit || this.prompts.length >= MAX_WINDOW_PROMPTS) return;

      const local = this.displayed - this.promptBase;
      const endOfDisplayed = matcher.promptStarts[local + 1] ?? matcher.tokens.length;
      const ahead = matcher.tokens.length - endOfDisplayed;
      if (ahead >= AHEAD_TOKENS) return;

      const perPrompt = Math.max(1, matcher.tokens.length / this.prompts.length);
      const count = Math.min(
        Math.max(1, Math.ceil((AHEAD_TOKENS - ahead) / perPrompt)),
        limit - have,
        MAX_WINDOW_PROMPTS - this.prompts.length,
      );
      const more: PromptItem[] = [];
      for (let i = 0; i < count; i++) more.push(this.nextPrompt());

      const firstNew = matcher.promptStarts.length;
      this.prompts.push(...more);
      const extended = extend(matcher, more);
      this.matcher = extended;
      this.streamPrompts.push(
        ...streamPromptsOf(extended, firstNew, this.promptBase, this.tokenBase),
      );
    }
  }

  private showPrompt(v: EngineView): void {
    const matcher = this.matcher;
    const local = this.displayed - this.promptBase;
    this._currentPrompt.value = this.prompts[local] ?? null;
    this._canonicalRomaji.value = matcher === null ? '' : canonical(matcher, local);
    this._isAssisted.value = this.assisted.has(this.displayed);
    this._completedPrompts.value = this.displayed;
    this.publishStream(this.tokenBase + v.displayedTokens);
  }

  // Publishes the window when the view needs it, cut to start at the line above the caret. Called
  // when the displayed prompt changes; the view is redrawn at most once per completed prompt, and in
  // practice every few dozen. What the view draws and the marks on its tokens change only here, so
  // an old token keeps its red mark for as long as it is on the screen.
  private publishStream(caret: number): void {
    const trim = Math.max(this.trimBefore, caret - HARD_BEHIND_TOKENS);
    const stale = staleCount(this.streamPrompts, trim);
    const current = stale > 0 ? this.streamPrompts.slice(stale) : this.streamPrompts;
    // Not at every change: see stream.ts. The view is redrawn when the window is about to run out.
    if (!shouldPublish(this._stream.value.prompts, current, caret)) return;
    this.streamPrompts = current.slice();
    const head = this.streamPrompts[0]?.firstToken ?? 0;
    for (const token of this.erroredAbs) {
      if (token < head) this.erroredAbs.delete(token);
    }
    this._stream.value = { prompts: this.streamPrompts.slice() };
  }

  private updateCaret(v: EngineView): void {
    this._caret.value = this.tokenBase + v.displayedTokens;
    this._romajiBuffer.value = v.pendingLatin;
  }

  private noteMistake(localToken: number, kind: Mistake['kind']): void {
    const token = this.tokenBase + localToken;
    this.erroredAbs.add(token);
    this.mistakeSeq += 1;
    this._mistake.value = { seq: this.mistakeSeq, token, kind };
  }

  /**
   * Records the results of the prompts before `upTo` (absolute), in order. While a test runs that
   * is the settled prompts; at its end, every committed prompt or the whole window, and a token
   * whose timing is still ambiguous is estimated to end at the last key.
   */
  private flushResults(upTo: number): void {
    const matcher = this.matcher;
    const state = this.matchState;
    if (matcher === null || state === null || this.recorded >= upTo) return;
    const now = this.keyTimes.at(-1) ?? this.clock.now();

    const timings = new Map<number, TokenTiming>();
    for (const t of committedTimings(matcher, state)) timings.set(t.tokenIndex, t);

    while (this.recorded < upTo) {
      const local = this.recorded - this.promptBase;
      const from = matcher.promptStarts[local] ?? 0;
      const to = matcher.promptStarts[local + 1] ?? matcher.tokens.length;
      const real: number[] = [];
      for (let t = from; t < to; t++) {
        if (matcher.tokens[t]?.kind !== 'skip') real.push(t);
      }

      const endedAt = this.committedAt.get(this.recorded) ?? now;
      const tokenOutcomes: { kanaKey: string | null; mistakes: number; ms: number }[] = [];
      let startedAt = endedAt;
      let mistakes = 0;
      for (const t of real) {
        const timing = timings.get(t);
        // Reaction time (spec metrics.md): a timed token runs from the keystroke before its first
        // one to its last; one whose paths are still ambiguous ends now and starts where the
        // previous token ended. The first token of a test has no such keystroke: ms = 0 is no
        // measurement.
        const end = timing === undefined ? endedAt : (this.keyTimeAt(timing.lastKey) ?? endedAt);
        const since =
          timing === undefined ? this.lastTokenEnd : this.keyTimeAt(timing.firstKey - 1);
        if (tokenOutcomes.length === 0 && timing !== undefined) {
          startedAt = this.keyTimeAt(timing.firstKey) ?? endedAt;
        }
        this.lastTokenEnd = end;
        const tokenMistakes = this.errorLog.mistakes(t);
        mistakes += tokenMistakes;
        tokenOutcomes.push({
          kanaKey: matcher.tokens[t]?.kanaKey ?? null,
          mistakes: tokenMistakes,
          ms: since === undefined ? 0 : Math.max(1, end - since),
        });
      }

      this.results.push({
        key: this.prompts[local]?.key ?? '',
        startedAt,
        endedAt,
        mistakes,
        assisted: this.assisted.has(this.recorded),
        tokenOutcomes,
      });
      this.recorded += 1;
    }
    this.resultsMark.value = { list: this.results, count: this.results.length };
  }

  // Drops settled prompts after every COMPACT_EVERY committed ones. They are the prompts that were
  // just recorded (settledPrompts in afterAccepted), so no result is lost.
  private compactIfDue(committed: number): void {
    const matcher = this.matcher;
    const state = this.matchState;
    if (matcher === null || state === null || committed < COMPACT_EVERY) return;
    const result = compact(matcher, state);
    if (result.droppedTokens === 0) return;

    // The keystrokes before the last one of the dropped tokens are not asked for any more: a token
    // that stays is timed from the keystroke before its first one.
    let keepFrom = this.keyBase;
    for (const timing of committedTimings(matcher, state)) {
      if (timing.tokenIndex < result.droppedTokens) keepFrom = Math.max(keepFrom, timing.lastKey);
    }
    this.keyTimes.splice(0, keepFrom - this.keyBase);
    this.keyBase = keepFrom;

    const droppedPrompts = this.prompts.length - result.m.promptStarts.length;
    this.matcher = result.m;
    this.matchState = result.s;
    this.prompts.splice(0, droppedPrompts);
    this.promptBase += droppedPrompts;
    this.errorLog.rebase(result.droppedTokens);
    this.tokenBase += result.droppedTokens;
    this.committedPtr = Math.max(0, this.committedPtr - result.droppedTokens);
    for (const k of this.committedAt.keys()) {
      if (k < this.promptBase) this.committedAt.delete(k);
    }
    for (const k of this.assisted) {
      if (k < this.promptBase) this.assisted.delete(k);
    }
  }

  private keyTimeAt(index: number): number | undefined {
    return this.keyTimes[index - this.keyBase];
  }

  private clearTimers(): void {
    if (this.deadlineTimeoutHandle) {
      this.scheduler.clearTimeout(this.deadlineTimeoutHandle);
      this.deadlineTimeoutHandle = null;
    }
    if (this.tickerIntervalHandle) {
      this.scheduler.clearInterval(this.tickerIntervalHandle);
      this.tickerIntervalHandle = null;
    }
  }
}
