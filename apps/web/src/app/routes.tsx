import type { ComponentType, JSX } from 'preact';
import { LearnPage } from '@/pages/learn';
import { loadDictionaryPart } from '@/shared/i18n';
import type { RoutePath } from './route-paths';

export type Route = {
  // Resolves to the screen. Every route but `/` is a dynamic import, so it is a separate chunk, and
  // brings the part of the dictionary that only this screen uses: the screen never shows before its
  // strings.
  readonly load: () => Promise<ComponentType>;
};

// `/` is in the initial chunk; it is the screen the application opens on.
function LearnRoute(): JSX.Element {
  return <LearnPage />;
}

// The typing screen is a lazy route; it takes no props here.
async function loadTrainer(): Promise<ComponentType> {
  const [{ TrainerPage }] = await Promise.all([
    import('@/pages/trainer'),
    loadDictionaryPart('type'),
  ]);
  return function TrainerRoute(): JSX.Element {
    return <TrainerPage />;
  };
}

export const EAGER_ROUTES: readonly (readonly [RoutePath, ComponentType])[] = [['/', LearnRoute]];

export const routes: Readonly<Record<RoutePath, Route>> = {
  '/': { load: () => Promise.resolve(LearnRoute) },
  '/type': { load: loadTrainer },
  '/stats': {
    load: () =>
      Promise.all([import('@/pages/stats'), loadDictionaryPart('stats')]).then(
        ([m]) => m.StatsPage,
      ),
  },
  '/settings': {
    load: () =>
      Promise.all([import('@/pages/settings'), loadDictionaryPart('settings')]).then(
        ([m]) => m.SettingsPage,
      ),
  },
  '/about': {
    load: () =>
      Promise.all([import('@/pages/about'), loadDictionaryPart('about')]).then(
        ([m]) => m.AboutPage,
      ),
  },
};
