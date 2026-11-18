import { signal } from '@preact/signals';
import type { ReadonlySignal } from '@preact/signals';

/**
 * Where the sync stands, first match wins (p5-plan.md, D17): the batch cannot succeed in this
 * version (`blocked`), the session expired (`expired`), no connection (`offline`), changes wait
 * (`pending`), everything is on the server (`synced`).
 */
export type SyncStatus = 'synced' | 'pending' | 'offline' | 'expired' | 'blocked';

const _status = signal<SyncStatus>('pending');

export const syncStatus: ReadonlySignal<SyncStatus> = _status;

export function setSyncStatus(next: SyncStatus): void {
  _status.value = next;
}
