import type { ReadonlySignal } from '@preact/signals';
import { batch, computed, effect, signal, untracked } from '@preact/signals';
import { createSession } from './session';
import type { Session } from './session';
import { setupSettingsResetWatcher } from './settings-watcher';
import { createPromptWeights } from '../lib/prompt-weights';
import { buildPool, chunksFor, loadChunk, pickPrompt } from '@/entities/prompt';
import type { ContentChunk, ContentItem, PromptItem } from '@/entities/prompt';
import {
  contentSetting,
  getPracticeSettings,
  scriptSetting,
  strictnessSetting,
  testConfig,
} from '@/entities/settings';
import { flushProgress, progressStats, recordTokenOutcomes } from '@/entities/stats';
import type { Clock, Rng, Scheduler } from '@/shared/lib';
import { defaultClock, defaultRng, defaultScheduler } from '@/shared/lib';

export type TrainerDeps = {
  // Replaces the weighted picker; tests use it to fix the prompts.
  readonly nextPrompt?: () => PromptItem;
  readonly rng?: Rng;
  readonly clock?: Clock;
  readonly scheduler?: Scheduler;
};

/**
 * The training screen as state: one session, the prompt source that feeds it, and the loading of
 * vocabulary content, chunk by chunk. A view reads these signals and calls `restart()`.
 */
export type Trainer = {
  readonly session: Session;
  readonly isLoadingContent: ReadonlySignal<boolean>;
  readonly contentLoadFailed: ReadonlySignal<boolean>;
  // Discards the running test and shows a fresh prompt.
  readonly restart: () => void;
  // Loads the selected vocabulary again after a failure.
  readonly retryContent: () => void;
  // Shows the first prompt and starts following the settings. Returns the function that stops it.
  readonly start: () => () => void;
};

export function createTrainer(deps: TrainerDeps = {}): Trainer {
  const rng = deps.rng ?? defaultRng;
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
        ? promptWeights(pool, progressStats.value)
        : new Map<string, number>();
      const picked = pickPrompt(pool, weights, rng, previousKey);
      previousKey = picked.key;
      return picked;
    });

  const session = createSession({
    nextPrompt,
    config: () => testConfig.value,
    clock: deps.clock ?? defaultClock,
    scheduler: deps.scheduler ?? defaultScheduler,
    // The prompts of the selected content are not here yet: nothing to type.
    inputBlocked: () => noPrompts.peek(),
    stats: { record: recordTokenOutcomes, flush: flushProgress },
    // A zen test ended with nothing to keep: a fresh prompt, as after a restart.
    onDiscard: () => {
      restart();
    },
  });

  const restart = (): void => {
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
      restart();
      const stopWatching = setupSettingsResetWatcher(restart);
      return () => {
        stopped = true;
        // Leaving the screen drops a running test (metrics.md): no timer outlives it.
        session.reset();
        stopWatching();
        stopLoading();
      };
    },
  };
}
