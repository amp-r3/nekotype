import { loadDictionaryPart } from '@/shared/i18n';
import type {
  openSession,
  openSummaryModel,
  SessionScreen,
  SummaryScreen,
} from './ui/session-runtime';

type SessionRuntime = {
  readonly openSession: typeof openSession;
  readonly openSummaryModel: typeof openSummaryModel;
  readonly SessionScreen: typeof SessionScreen;
  readonly SummaryScreen: typeof SummaryScreen;
};

let loaded: SessionRuntime | undefined;
let inflight: Promise<SessionRuntime | null> | undefined;

function fetchRuntime(): Promise<SessionRuntime | null> {
  if (loaded !== undefined) return Promise.resolve(loaded);
  if (inflight !== undefined) return inflight;
  const runtime = import('./ui/session-runtime').then(async (module) => {
    await module.loadSessionStyles();
    return module;
  });
  const request = Promise.all([runtime, loadDictionaryPart('session')])
    .then(([module]) => {
      loaded = module;
      return module;
    })
    .catch(() => null)
    .finally(() => {
      inflight = undefined;
    });
  inflight = request;
  return request;
}

export type { SessionRuntime };

/**
 * The session code (a chunk of its own), its strings and its stylesheet, or null if one of them
 * could not be loaded; a later call retries.
 */
export function loadSessionRuntime(): Promise<SessionRuntime | null> {
  return fetchRuntime();
}

/** Fetches the session code, its strings and its stylesheet ahead of time; a failure is ignored. */
export async function prefetchSessionRuntime(): Promise<void> {
  await fetchRuntime();
}
