let handler: (() => void) | null = null;

/** The end of a learning session asks for a sync. With no engine (a guest) nothing happens. */
export function requestSync(): void {
  handler?.();
}

/** The sync engine registers here; the returned function removes the handler. */
export function onSyncRequest(next: () => void): () => void {
  handler = next;
  return () => {
    if (handler === next) handler = null;
  };
}
