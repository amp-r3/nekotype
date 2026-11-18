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

const _online = signal(true);

/**
 * The server can be reached as far as the engine knows: the browser is online and the last request
 * did not fail on the network. Sign-out needs it (ADR 079).
 */
export const syncOnline: ReadonlySignal<boolean> = _online;

export function setSyncOnline(next: boolean): void {
  _online.value = next;
}
