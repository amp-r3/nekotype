import type { TestResult } from '@nekotype/shared/types';
import { isResultsResponse } from '@nekotype/shared/runtime';
import type { FetchLike } from '@/shared/api';
import { apiFetch } from '@/shared/api';

/** One page of the server's history: `next` is the cursor of the following page, `null` on the last. */
export type HistoryPage =
  | { readonly kind: 'ok'; readonly results: readonly TestResult[]; readonly next: string | null }
  | { readonly kind: 'failed' };

/** The cursor `before` of `GET /api/results` for the result at the end of what is held. */
export function historyCursor(result: Pick<TestResult, 'endedAt' | 'id'>): string {
  return `${result.endedAt}:${result.id}`;
}

/**
 * `GET /api/results?before=`: the page of results older than the cursor, newest first, or the
 * newest page for `null`. Any failure is `failed`: an expired session is the sync engine's to
 * report, the history simply stops growing.
 */
export async function fetchHistoryPage(
  before: string | null,
  fetchFn?: FetchLike,
): Promise<HistoryPage> {
  const path =
    before === null ? '/api/results' : `/api/results?before=${encodeURIComponent(before)}`;
  const response = await apiFetch(path, {}, fetchFn);
  if (response.kind !== 'ok' || !isResultsResponse(response.body)) return { kind: 'failed' };
  return { kind: 'ok', results: response.body.results, next: response.body.next };
}
