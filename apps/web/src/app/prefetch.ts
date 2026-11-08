import type { ContentKind } from '@/entities/settings';
import { loadContent } from '@/entities/prompt';
import { preloadLocale } from '@/shared/i18n';
import { prefetchSessionRuntime, prefetchSummaryPanel } from '@/pages/learn';
import { routes } from './routes';
import { ROUTE_PATHS } from './route-paths';

type VocabularyKind = 'words' | 'phrases';

/** The content chunks worth having before the network drops: the selected vocabulary. */
export function contentKindsFor(content: ContentKind): readonly VocabularyKind[] {
  return [content];
}

export type PrefetchDeps = {
  readonly content: ContentKind;
  readonly loadRoute: (path: (typeof ROUTE_PATHS)[number]) => Promise<unknown>;
  readonly loadContent: (kind: VocabularyKind) => Promise<unknown>;
  // The other lazy pieces of the first screen: the results panel, the session summary and the Russian dictionary.
  readonly loadExtras: readonly (() => Promise<unknown>)[];
};

/**
 * Fetches every lazy screen and the content chunks for the settings, so the application stays
 * usable if the connection is lost after the first load (spec "Loading"). A failure is ignored: the
 * screen loads again, and reports an error itself, when it is opened.
 */
export async function prefetch(deps: PrefetchDeps): Promise<void> {
  const requests = [
    ...ROUTE_PATHS.map((path) => deps.loadRoute(path)),
    ...contentKindsFor(deps.content).map((kind) => deps.loadContent(kind)),
    ...deps.loadExtras.map((load) => load()),
  ];
  await Promise.allSettled(requests);
}

export type IdleScheduler = {
  readonly requestIdleCallback?: ((callback: () => void) => unknown) | undefined;
  readonly setTimeout: (callback: () => void, ms: number) => unknown;
};

// Safari has no requestIdleCallback; a timer after the first frames is close enough.
const FALLBACK_DELAY_MS = 1500;

export function runWhenIdle(task: () => void, scheduler: IdleScheduler): void {
  if (scheduler.requestIdleCallback) {
    scheduler.requestIdleCallback(task);
  } else {
    scheduler.setTimeout(task, FALLBACK_DELAY_MS);
  }
}

export function schedulePrefetch(content: () => ContentKind): void {
  runWhenIdle(
    () => {
      void prefetch({
        content: content(),
        loadRoute: (path) => routes[path].load(),
        loadContent,
        loadExtras: [
          () => import('@/pages/trainer').then((module) => module.prefetchResultsPanel()),
          prefetchSummaryPanel,
          prefetchSessionRuntime,
          () => preloadLocale('ru'),
        ],
      });
    },
    {
      requestIdleCallback:
        typeof window.requestIdleCallback === 'function'
          ? (callback) => window.requestIdleCallback(callback)
          : undefined,
      setTimeout: (callback, ms) => window.setTimeout(callback, ms),
    },
  );
}
