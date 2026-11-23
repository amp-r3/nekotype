import type { ApiResult, FetchLike } from '@/shared/api';
import { apiFetch } from '@/shared/api';

/** The requests of the sync protocol (backend.md, "API"); `fetch` is injected. */
export type SyncApi = {
  /** `POST /api/sync`. `body` is the serialized batch. */
  readonly post: (body: string, keepalive: boolean) => Promise<ApiResult>;
  /** `GET /api/sync?after=`: one page of the rows other devices wrote after `after`. */
  readonly pull: (after: number) => Promise<ApiResult>;
};

export function createSyncApi(deviceId: string, fetchFn: FetchLike): SyncApi {
  return {
    post: (body, keepalive) => apiFetch('/api/sync', { method: 'POST', body, keepalive }, fetchFn),
    pull: (after) =>
      apiFetch(
        `/api/sync?deviceId=${encodeURIComponent(deviceId)}&after=${String(after)}`,
        {},
        fetchFn,
      ),
  };
}
