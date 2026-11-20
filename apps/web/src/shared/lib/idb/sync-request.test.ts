import { afterEach, describe, expect, it, vi } from 'vitest';
import { onSyncRequest, requestSync } from './sync-request';

describe('requestSync', () => {
  let off: (() => void) | null = null;
  afterEach(() => {
    off?.();
    off = null;
  });

  it('does nothing without a handler', () => {
    expect(() => {
      requestSync();
    }).not.toThrow();
  });

  it('calls the registered handler', () => {
    const handler = vi.fn();
    off = onSyncRequest(handler);
    requestSync();
    expect(handler).toHaveBeenCalledOnce();
  });

  it('stops calling a handler that was removed', () => {
    const handler = vi.fn();
    onSyncRequest(handler)();
    requestSync();
    expect(handler).not.toHaveBeenCalled();
  });
});
