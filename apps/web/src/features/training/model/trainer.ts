import type { ReadonlySignal } from '@preact/signals';
import { batch, computed, effect, signal, untracked } from '@preact/signals';
import { createSession } from './session';
import type { Session } from './session';
import { setupSettingsResetWatcher } from './settings-watcher';
import { createPromptWeights } from '../lib/prompt-weights';
import { CONTENT_VERSION, buildPool, chunksFor, loadChunk, pickPrompt } from '@/entities/prompt';
import type { ContentChunk, ContentItem, PromptItem } from '@/entities/prompt';
import {
  contentSetting,
  getPracticeSettings,
  scriptSetting,
  strictnessSetting,
  testConfig,
} from '@/entities/settings';
import type { SavedTest, TypingStore } from '@/entities/stats';
import { initTyping, recordDiscardedTest, saveTest, typingKanaStats } from '@/entities/stats';
import type { Clock, Rng, Scheduler } from '@/shared/lib';
import { defaultClock, defaultRng, defaultScheduler, uuidv7 } from '@/shared/lib';
import { roundAccuracy, roundKpm } from '@nekotype/shared/runtime';
import type { TestResult } from '@nekotype/shared/types';
import type { EndedTest } from './types';

export type TrainerDeps = {
  // Replaces the weighted picker; tests use it to fix the prompts.
  readonly nextPrompt?: () => PromptItem;
  readonly rng?: Rng;
  readonly clock?: Clock;
  readonly scheduler?: Scheduler;
  // Where a finished test is saved; the typing statistics store by default.
  readonly typing?: Pick<TypingStore, 'saveTest' | 'recordDiscarded'>;
  // Makes the id of a result from the time; a UUID v7 by default.
  readonly newId?: (now: number) => string;
};

const APP_VERSION: string = __APP_VERSION__;

/**
 * The training screen as state: one session, the prompt source that feeds it, and the loading of
 * vocabulary content, chunk by chunk. A view reads these signals and calls `restart()`.
 */
export type Trainer = {
  readonly session: Session;
  readonly isLoadingContent: ReadonlySignal<boolean>;
  readonly contentLoadFailed: ReadonlySignal<boolean>;
  // The last saved test with the average and the best it was compared with; null while a test runs.
  readonly lastSaved: ReadonlySignal<SavedTest | null>;
  // Discards the running test and shows a fresh prompt.
  readonly restart: () => void;
  // Loads the selected vocabulary again after a failure.
  readonly retryContent: () => void;
  // Shows the first prompt and starts following the settings. Returns the function that stops it.
  readonly start: () => () => void;
};

export function createTrainer(deps: TrainerDeps = {}): Trainer {
  const rng = deps.rng ?? defaultRng;
  const clock = deps.clock ?? defaultClock;
  const typing = deps.typing ?? { saveTest, recordDiscarded: recordDiscardedTest };
  const newId = deps.newId ?? ((now: number) => uuidv7(now));
  const lastSaved = signal<SavedTest | null>(null);
  const promptWeights = createPromptWeights();
  // Loaded chunks, kept whatever the selection does next, so a chunk is fetched once. An empty
  // chunk is loaded too.
  const chunks = new Map<ContentChunk, readonly ContentItem[]>();
  let previousKey: string | null = null;
  let stopped = false;

  // Loads in flight and failed ones, per chunk. Only the chunks of the selected (content, script)
  // are shown or block input.
  const loading = signal<ReadonlySet<ContentChunk>>(new Set());
  const failed = signal<ReadonlySet<ContentChunk>>(new Set());
  const selectedChunks = (): readonly ContentChunk[] =>
    chunksFor(contentSetting.value, scriptSetting.value);
  const isLoadingContent = computed(() => selectedChunks().some((c) => loading.value.has(c)));
  const contentLoadFailed = computed(() => selectedChunks().some((c) => failed.value.has(c)));

  const selectedItems = (): readonly ContentItem[] =>
    selectedChunks().flatMap((c) => chunks.get(c) ?? []);

  // No prompt to show: the selected vocabulary is loading, failed to load, or has nothing for the
  // script. The notice slot says which; Retry loads it again.
  const noPrompts = computed(() => {
    if (isLoadingContent.value || contentLoadFailed.value) return true;
    return (
      deps.nextPrompt === undefined &&
      buildPool(getPracticeSettings(), selectedItems()).length === 0
    );
  });

  const nextPrompt =
    deps.nextPrompt ??
    ((): PromptItem => {
      const settings = getPracticeSettings();
      const pool = buildPool(settings, selectedItems());
      const weights = settings.weakFocus
        ? promptWeights(pool, typingKanaStats.value)
        : new Map<string, number>();
      const picked = pickPrompt(pool, weights, rng, previousKey);
      previousKey = picked.key;
      return picked;
    });

  // The result of a test that ended and is kept: the settings, the id and the versions join the
  // session's report (ADR 073). `repeated` is false until Repeat exists.
  const toResult = (ended: EndedTest): TestResult => {
    const { content, script } = getPracticeSettings();
    const minutes = ended.durationMs / 60000;
    return {
      id: newId(ended.endedAt),
      content,
      script,
      strictness: ended.strictness,
      config: ended.config,
      endReason: ended.endReason,
      repeated: false,
      startedAt: ended.startedAt,
      endedAt: ended.endedAt,
      durationMs: ended.durationMs,
      tokens: ended.tokens,
      erroredTokens: ended.erroredTokens,
      items: ended.items,
      keystrokes: ended.keystrokes,
      rejectedKeystrokes: ended.rejectedKeystrokes,
      assisted: ended.assisted,
      kpm: minutes > 0 ? roundKpm(ended.tokens / minutes) : 0,
      kanaAccuracy:
        ended.tokens > 0 ? roundAccuracy((ended.tokens - ended.erroredTokens) / ended.tokens) : 1,
      celebratedPersonalBest: false,
      contentVersion: CONTENT_VERSION,
      appVersion: APP_VERSION,
    };
  };

  const session = createSession({
    nextPrompt,
    config: () => testConfig.value,
    clock,
    scheduler: deps.scheduler ?? defaultScheduler,
    // The prompts of the selected content are not here yet: nothing to type.
    inputBlocked: () => noPrompts.peek(),
    onEnd: (ended) => {
      void typing
        .saveTest({ result: toResult(ended), kanaDelta: ended.kanaDelta, startedIncrement: 1 })
        .then((saved) => {
          lastSaved.value = saved;
        });
    },
    // A zen test ended with nothing to keep: a fresh prompt, as after a restart.
    onDiscard: () => {
      restart();
    },
  });

  // A test that started and ends without being kept counts as started only (metrics.md, D23).
  const dropRunning = (): void => {
    if (session.phase.peek() === 'running') void typing.recordDiscarded();
    lastSaved.value = null;
  };

  const restart = (): void => {
    dropRunning();
    session.reset();
    // While the selected vocabulary loads, or after it failed, there is no prompt; its arrival or
    // Retry restarts again.
    if (noPrompts.peek()) return;
    session.loadPrompt(nextPrompt(), strictnessSetting.value);
  };

  const mark = (set: typeof loading, chunk: ContentChunk, on: boolean): void => {
    const next = new Set(set.value);
    if (on) next.add(chunk);
    else next.delete(chunk);
    set.value = next;
  };

  const isSelected = (chunk: ContentChunk): boolean => selectedChunks().includes(chunk);

  const ensureLoaded = (chunk: ContentChunk): void => {
    if (chunks.has(chunk) || loading.peek().has(chunk)) return;
    batch(() => {
      mark(loading, chunk, true);
      mark(failed, chunk, false);
    });
    // Drop the prompt on display until the vocabulary is here.
    if (!stopped && isSelected(chunk)) restart();
    void loadChunk(chunk)
      .then((items) => {
        chunks.set(chunk, items);
        mark(loading, chunk, false);
        if (!stopped && isSelected(chunk)) restart();
      })
      .catch(() => {
        batch(() => {
          mark(loading, chunk, false);
          mark(failed, chunk, true);
        });
        // The setting stays; there is nothing to practise until Retry.
        if (!stopped && isSelected(chunk)) restart();
      });
  };

  return {
    session,
    isLoadingContent,
    contentLoadFailed,
    lastSaved,
    restart,
    retryContent() {
      for (const chunk of selectedChunks()) ensureLoaded(chunk);
      restart();
    },
    start() {
      stopped = false;
      // Loading first: a selected vocabulary that is missing blocks the first prompt.
      const stopLoading = effect(() => {
        const wanted = chunksFor(contentSetting.value, scriptSetting.value);
        untracked(() => {
          for (const chunk of wanted) ensureLoaded(chunk);
        });
      });
      void initTyping();
      restart();
      const stopWatching = setupSettingsResetWatcher(restart);
      return () => {
        stopped = true;
        // Leaving the screen drops a running test (metrics.md): no timer outlives it.
        dropRunning();
        session.reset();
        stopWatching();
        stopLoading();
      };
    },
  };
}
