import { apiFetch } from '@/shared/api';
import type { FetchLike } from '@/shared/api';
import type { ReportRequest } from '@nekotype/shared/types';

/** `sent` (204), `turnstile` (the check failed: `403 turnstile_failed`), or `failed` (anything else). */
export type ReportOutcome = 'sent' | 'turnstile' | 'failed';

export type ReportSender = (request: ReportRequest) => Promise<ReportOutcome>;

/** `POST /api/reports`. The token is single-use, so a retry needs a new one. */
export async function sendReport(
  request: ReportRequest,
  fetchFn?: FetchLike,
): Promise<ReportOutcome> {
  const result = await apiFetch(
    '/api/reports',
    { method: 'POST', body: JSON.stringify(request) },
    fetchFn,
  );
  if (result.kind === 'ok') return 'sent';
  if (result.kind === 'error' && result.code === 'turnstile_failed') return 'turnstile';
  return 'failed';
}
