// The screens of the application. `public/_redirects` lists every path but `/`, and a test keeps
// the two in step.
export const ROUTE_PATHS = ['/', '/type', '/stats', '/settings', '/about'] as const;

export type RoutePath = (typeof ROUTE_PATHS)[number];

export function isRoutePath(path: string): path is RoutePath {
  return ROUTE_PATHS.some((known) => known === path);
}
