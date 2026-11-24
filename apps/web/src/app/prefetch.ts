import { preloadLocale } from '@/shared/i18n';
import { prefetchKanaDetails } from '@/features/kana-details';
import { prefetchSessionRuntime, prefetchSummaryPanel } from '@/pages/learn';
import { routes } from './routes';
import { ROUTE_PATHS } from './route-paths';

export type PrefetchDeps = {
  readonly loadRoute: (path: (typeof ROUTE_PATHS)[number]) => Promise<unknown>;
  // The other lazy pieces: the session runtime, the session summary, the kana details and both whole dictionaries.
  readonly loadExtras: readonly (() => Promise<unknown>)[];
};

/**
 * Fetches every lazy screen and the other lazy pieces, so the application stays usable if the
 * connection is lost after the first load (spec "Loading"). A failure is ignored: the screen loads
 * again, and reports an error itself, when it is opened.
 */
export async function prefetch(deps: PrefetchDeps): Promise<void> {
  const requests = [
    ...ROUTE_PATHS.map((path) => deps.loadRoute(path)),
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

export function schedulePrefetch(): void {
  runWhenIdle(
    () => {
      void prefetch({
        loadRoute: (path) => routes[path].load(),
        loadExtras: [
          prefetchSummaryPanel,
          prefetchKanaDetails,
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
