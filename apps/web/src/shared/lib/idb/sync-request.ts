/** Why a sync is wanted: a learning session or a typing test just ended. */
export type SyncReason = 'learn' | 'test';

let handler: ((reason: SyncReason) => void) | null = null;

/** The end of a learning session or a typing test asks for a sync. With no engine (a guest) nothing happens. */
export function requestSync(reason: SyncReason): void {
  handler?.(reason);
}

/** The sync engine registers here; the returned function removes the handler. */
export function onSyncRequest(next: (reason: SyncReason) => void): () => void {
  handler = next;
  return () => {
    if (handler === next) handler = null;
  };
}
