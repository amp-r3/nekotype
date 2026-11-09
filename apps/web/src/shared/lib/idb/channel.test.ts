import { describe, it, expect, vi } from 'vitest';
import { changeChannel } from './channel';

describe('changeChannel', () => {
  it('is a no-op in unit tests: nothing throws and no listener is called', () => {
    const channel = changeChannel('nekotype:test');
    const onChange = vi.fn();
    expect(() => {
      channel.listen(onChange);
      channel.post();
    }).not.toThrow();
    expect(onChange).not.toHaveBeenCalled();
  });
});
