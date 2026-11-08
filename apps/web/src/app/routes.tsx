import type { ComponentType, JSX } from 'preact';
import { LearnPage } from '@/pages/learn';
import type { RoutePath } from './route-paths';

export type Route = {
  // Resolves to the screen. Every route but `/` is a dynamic import, so it is a separate chunk.
  readonly load: () => Promise<ComponentType>;
};

// `/` is in the initial chunk; it is the screen the application opens on.
function LearnRoute(): JSX.Element {
  return <LearnPage />;
}

// The typing screen is a lazy route; it takes no props here.
async function loadTrainer(): Promise<ComponentType> {
  const { TrainerPage } = await import('@/pages/trainer');
  return function TrainerRoute(): JSX.Element {
    return <TrainerPage />;
  };
}

export const EAGER_ROUTES: readonly (readonly [RoutePath, ComponentType])[] = [['/', LearnRoute]];

export const routes: Readonly<Record<RoutePath, Route>> = {
  '/': { load: () => Promise.resolve(LearnRoute) },
  '/type': { load: loadTrainer },
  '/stats': { load: () => import('@/pages/stats').then((m) => m.StatsPage) },
  '/settings': { load: () => import('@/pages/settings').then((m) => m.SettingsPage) },
  '/about': { load: () => import('@/pages/about').then((m) => m.AboutPage) },
};
