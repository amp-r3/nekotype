import { loadDictionaryPart } from '@/shared/i18n';
import type { HomeForecast } from './ui/home/panels/home-forecast';
import type { HomePath } from './ui/home/panels/home-path';
import type { HomeSince } from './ui/home/panels/home-since';

export type HomePanels = {
  readonly HomeForecast: typeof HomeForecast;
  readonly HomePath: typeof HomePath;
  readonly HomeSince: typeof HomeSince;
};

// The path, the forecast and "what got stronger" are a chunk of their own with their strings, so the
// first load does not carry them (P8 plan, D14). The home asks for them when it is shown, in
// parallel with the model, and on idle (`prefetchHomePanels`).
let loaded: Promise<HomePanels> | undefined;

/** The panels and their strings, fetched once; a failure is not kept, so a later call tries again. */
export function loadHomePanels(): Promise<HomePanels> {
  if (loaded !== undefined) return loaded;
  const request = Promise.all([import('./ui/home/panels/home-panels'), loadDictionaryPart('home')])
    .then(([module]) => module)
    .catch((error: unknown) => {
      loaded = undefined;
      throw error;
    });
  loaded = request;
  return request;
}

/** Fetches the panels ahead of time; a failure is ignored (they load again when the home shows). */
export async function prefetchHomePanels(): Promise<void> {
  await loadHomePanels().catch(() => undefined);
}
