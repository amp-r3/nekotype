// The screens of the application. `public/_redirects` lists every path but `/`, and a test keeps
// the two in step.
export const ROUTE_PATHS = ['/', '/progress', '/settings', '/about'] as const;

export type RoutePath = (typeof ROUTE_PATHS)[number];

// Paths that led to a screen once and now lead to another: a 301 at the edge (`_redirects`) and a
// replacement in the router, which covers the dev server and a stale copy of `index.html`.
export const ROUTE_REDIRECTS = { '/stats': '/progress' } as const;

export function isRoutePath(path: string): path is RoutePath {
  return ROUTE_PATHS.some((known) => known === path);
}
