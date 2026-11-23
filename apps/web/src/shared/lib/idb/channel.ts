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

export type TypedChannel<M> = {
  readonly post: (message: M) => void;
  /** Messages that fail `isMessage` are dropped. */
  readonly listen: (onMessage: (message: M) => void) => void;
};

/**
 * A channel of structured messages (`nekotype:learn`, P7 plan D16). A no-op in unit tests and where
 * `BroadcastChannel` is missing.
 */
export function typedChannel<M>(
  name: string,
  isMessage: (value: unknown) => value is M,
): TypedChannel<M> {
  const channel =
    import.meta.env.MODE !== 'test' && typeof BroadcastChannel === 'function'
      ? new BroadcastChannel(name)
      : null;
  return {
    post: (message) => {
      channel?.postMessage(message);
    },
    listen: (onMessage) => {
      channel?.addEventListener('message', (event: MessageEvent<unknown>) => {
        if (isMessage(event.data)) onMessage(event.data);
      });
    },
  };
}
