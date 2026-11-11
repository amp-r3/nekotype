import type { ContentKind, ScriptMode } from '@/entities/settings';
import { chunksFor, loadChunk } from '@/entities/prompt';
import type { ContentChunk } from '@/entities/prompt';
import { preloadLocale } from '@/shared/i18n';
import { prefetchSessionRuntime, prefetchSummaryPanel } from '@/pages/learn';
import { routes } from './routes';
import { ROUTE_PATHS } from './route-paths';

export type PrefetchDeps = {
  readonly content: ContentKind;
  readonly script: ScriptMode;
  readonly loadRoute: (path: (typeof ROUTE_PATHS)[number]) => Promise<unknown>;
  readonly loadChunk: (chunk: ContentChunk) => Promise<unknown>;
  // The other lazy pieces: the results panel, the session summary and both whole dictionaries.
  readonly loadExtras: readonly (() => Promise<unknown>)[];
};

/**
 * Fetches every lazy screen and the content chunks of the selected content and script, so the application stays
 * usable if the connection is lost after the first load (spec "Loading"). A failure is ignored: the
 * screen loads again, and reports an error itself, when it is opened.
 */
export async function prefetch(deps: PrefetchDeps): Promise<void> {
  const requests = [
    ...ROUTE_PATHS.map((path) => deps.loadRoute(path)),
    ...chunksFor(deps.content, deps.script).map((chunk) => deps.loadChunk(chunk)),
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

export function schedulePrefetch(
  settings: () => {
    readonly content: ContentKind;
    readonly script: ScriptMode;
  },
): void {
  runWhenIdle(
    () => {
      void prefetch({
        ...settings(),
        loadRoute: (path) => routes[path].load(),
        loadChunk,
        loadExtras: [
          () => import('@/pages/trainer').then((module) => module.prefetchResultsPanel()),
          prefetchSummaryPanel,
          prefetchSessionRuntime,
          () => preloadLocale('en'),
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
