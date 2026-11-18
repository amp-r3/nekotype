import type { SnapshotBuckets, SnapshotRecent, SnapshotRest } from '@nekotype/shared/types';
import { isSnapshotBuckets, isSnapshotRecent, isSnapshotRest } from '@nekotype/shared/runtime';
import type { ApiResult, FetchLike } from '@/shared/api';
import { apiFetch } from '@/shared/api';

export type Parts = {
  readonly rest: SnapshotRest;
  readonly recent: SnapshotRecent;
  readonly buckets: SnapshotBuckets;
};

/** The requests of the sync protocol (backend.md, "API"); `fetch` is injected. */
export type SyncApi = {
  /** `POST /api/sync`. `body` is the serialized batch. */
  readonly post: (body: string, keepalive: boolean) => Promise<ApiResult>;
  /** `GET /api/sync` without `part`: the last applied `seq` and the `version`. */
  readonly check: () => Promise<ApiResult>;
  /**
   * The three parts of the snapshot, read again while their `version` values differ (at most
   * `attempts` times). Null when a request fails, a part is malformed or the versions never agree.
   */
  readonly readParts: (attempts?: number) => Promise<Parts | null>;
};

export function createSyncApi(deviceId: string, fetchFn: FetchLike): SyncApi {
  const url = (part?: string): string =>
    `/api/sync?deviceId=${encodeURIComponent(deviceId)}${part === undefined ? '' : `&part=${part}`}`;
  const get = (part: string): Promise<ApiResult> => apiFetch(url(part), {}, fetchFn);

  return {
    post: (body, keepalive) => apiFetch('/api/sync', { method: 'POST', body, keepalive }, fetchFn),
    check: () => apiFetch(url(), {}, fetchFn),
    async readParts(attempts = 3) {
      for (let attempt = 0; attempt < attempts; attempt += 1) {
        const [rest, recent, buckets] = await Promise.all([
          get('rest'),
          get('recent'),
          get('buckets'),
        ]);
        if (rest.kind !== 'ok' || recent.kind !== 'ok' || buckets.kind !== 'ok') return null;
        if (
          !isSnapshotRest(rest.body) ||
          !isSnapshotRecent(recent.body) ||
          !isSnapshotBuckets(buckets.body)
        ) {
          return null;
        }
        if (
          rest.body.version === recent.body.version &&
          rest.body.version === buckets.body.version
        ) {
          return { rest: rest.body, recent: recent.body, buckets: buckets.body };
        }
      }
      return null;
    },
  };
}
