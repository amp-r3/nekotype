/** `change`: a store wrote its record. `reset`: "Reset progress" cleared it, so a tab drops what it holds unwritten too. */
export type ChannelMessage = 'change' | 'reset';

export type ChangeChannel = {
  readonly post: (message?: ChannelMessage) => void;
  readonly listen: (onChange: (message: ChannelMessage) => void) => void;
};

/**
 * Tells the other tabs that a stored record changed; they read the records again and merge them
 * with what they hold (p5-plan.md, D18). A no-op in unit tests and where `BroadcastChannel` is
 * missing.
 */
export function changeChannel(name: string): ChangeChannel {
  const channel =
    import.meta.env.MODE !== 'test' && typeof BroadcastChannel === 'function'
      ? new BroadcastChannel(name)
      : null;
  return {
    post: (message = 'change') => {
      channel?.postMessage(message);
    },
    listen: (onChange) => {
      channel?.addEventListener('message', (event: MessageEvent<unknown>) => {
        onChange(event.data === 'reset' ? 'reset' : 'change');
      });
    },
  };
}
