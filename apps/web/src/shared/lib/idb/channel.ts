export type ChangeChannel = {
  readonly post: () => void;
  readonly listen: (onChange: () => void) => void;
};

/**
 * Tells the other tabs that a stored record changed (until P5 merges them). A no-op in unit tests
 * and where `BroadcastChannel` is missing.
 */
export function changeChannel(name: string): ChangeChannel {
  const channel =
    import.meta.env.MODE !== 'test' && typeof BroadcastChannel === 'function'
      ? new BroadcastChannel(name)
      : null;
  return {
    post: () => {
      channel?.postMessage(0);
    },
    listen: (onChange) => {
      channel?.addEventListener('message', onChange);
    },
  };
}
