import type { openSession, SessionScreen } from './ui/session-runtime';

type SessionRuntime = {
  readonly openSession: typeof openSession;
  readonly SessionScreen: typeof SessionScreen;
};

let loaded: SessionRuntime | undefined;
let inflight: Promise<SessionRuntime | null> | undefined;

function fetchRuntime(): Promise<SessionRuntime | null> {
  if (loaded !== undefined) return Promise.resolve(loaded);
  if (inflight !== undefined) return inflight;
  const request = import('./ui/session-runtime')
    .then((module) => {
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

/** The session code (a chunk of its own), or null if it could not be loaded; a later call retries. */
export function loadSessionRuntime(): Promise<SessionRuntime | null> {
  return fetchRuntime();
}

/** Fetches the session code ahead of time; a failure is ignored. */
export async function prefetchSessionRuntime(): Promise<void> {
  await fetchRuntime();
}
