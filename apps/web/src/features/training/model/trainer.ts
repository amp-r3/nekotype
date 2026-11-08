import type { ReadonlySignal } from '@preact/signals';
import { batch, computed, effect, signal, untracked } from '@preact/signals';
import { createSession } from './session';
import type { Session } from './session';
import { setupSettingsResetWatcher } from './settings-watcher';
import { createPromptWeights } from '../lib/prompt-weights';
import { buildPool, loadContent, pickPrompt } from '@/entities/prompt';
import type { ContentItem, PromptItem } from '@/entities/prompt';
import {
  contentSetting,
  getPracticeSettings,
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
 * vocabulary content. A view reads these signals and calls `restart()`.
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

type VocabularyKind = 'words' | 'phrases';

export function createTrainer(deps: TrainerDeps = {}): Trainer {
  const rng = deps.rng ?? defaultRng;
  const promptWeights = createPromptWeights();
  const vocabulary: Record<VocabularyKind, readonly ContentItem[]> = { words: [], phrases: [] };
  let previousKey: string | null = null;
  let stopped = false;

  // Loads in flight and failed ones, per kind. Only the selected kind is shown or blocks input.
  const loading = signal<ReadonlySet<VocabularyKind>>(new Set());
  const failed = signal<ReadonlySet<VocabularyKind>>(new Set());
  const selectedKind = (): VocabularyKind => contentSetting.value;
  const isLoadingContent = computed(() => loading.value.has(selectedKind()));
  const contentLoadFailed = computed(() => failed.value.has(selectedKind()));

  // No prompt to show: the selected vocabulary is loading, failed to load, or has nothing for the
  // script. The notice slot says which; Retry loads it again.
  const noPrompts = computed(() => {
    if (isLoadingContent.value || contentLoadFailed.value) return true;
    return (
      deps.nextPrompt === undefined &&
      buildPool(getPracticeSettings(), vocabulary[selectedKind()]).length === 0
    );
  });

  const nextPrompt =
    deps.nextPrompt ??
    ((): PromptItem => {
      const settings = getPracticeSettings();
      const pool = buildPool(settings, vocabulary[settings.content]);
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

  const mark = (set: typeof loading, kind: VocabularyKind, on: boolean): void => {
    const next = new Set(set.value);
    if (on) next.add(kind);
    else next.delete(kind);
    set.value = next;
  };

  const ensureLoaded = (kind: VocabularyKind): void => {
    if (vocabulary[kind].length > 0 || loading.peek().has(kind)) return;
    batch(() => {
      mark(loading, kind, true);
      mark(failed, kind, false);
    });
    // Drop the prompt on display until the vocabulary is here.
    if (!stopped && selectedKind() === kind) restart();
    void loadContent(kind)
      .then((items) => {
        // Kept whatever happens next, so the kind is not fetched again.
        vocabulary[kind] = items;
        mark(loading, kind, false);
        if (!stopped && selectedKind() === kind) restart();
      })
      .catch(() => {
        batch(() => {
          mark(loading, kind, false);
          mark(failed, kind, true);
        });
        // The setting stays; there is nothing to practise until Retry.
        if (!stopped && selectedKind() === kind) restart();
      });
  };

  return {
    session,
    isLoadingContent,
    contentLoadFailed,
    restart,
    retryContent() {
      ensureLoaded(selectedKind());
      restart();
    },
    start() {
      stopped = false;
      // Loading first: a selected vocabulary that is missing blocks the first prompt.
      const stopLoading = effect(() => {
        const kind = contentSetting.value;
        untracked(() => {
          ensureLoaded(kind);
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
