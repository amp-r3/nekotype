import { describe, expect, it } from 'vitest';
import { encodePage } from '@nekotype/shared/runtime';
import { LOG_DEV, eventsOf, settingsAt } from '../model/test-util';
import { lastNOf, readOutbox } from './stored';

const outbox = () => ({
  seq: 1,
  request: {
    v: 4,
    deviceId: 'dev',
    seq: 1,
    after: 0,
    log: encodePage(eventsOf(LOG_DEV, 5, 3)),
    settings: null,
  },
});

describe('stored records', () => {
  it('reads a whole outbox and rejects one with a broken part', () => {
    expect(readOutbox(outbox())).not.toBeNull();
    expect(readOutbox({ ...outbox(), seq: 2 })).toBeNull();
    expect(readOutbox(undefined)).toBeNull();
    const base = outbox();
    expect(readOutbox({ ...base, request: { ...base.request, log: { dev: 1 } } })).toBeNull();
    expect(readOutbox({ ...base, request: { ...base.request, after: -1 } })).toBeNull();
    expect(readOutbox({ ...base, request: { ...base.request, settings: 3 } })).toBeNull();
    expect(readOutbox({ ...base, request: { ...base.request, deviceId: 4 } })).toBeNull();
  });

  it('reads a batch of settings only', () => {
    const base = outbox();
    const batch = readOutbox({
      ...base,
      request: { ...base.request, log: null, settings: settingsAt(4) },
    });
    expect(batch?.request.settings?.updatedAt).toBe(4);
    expect(batch === null ? 0 : lastNOf(batch.request)).toBeNull();
  });

  it('reads the settings of a batch of an earlier version without the target answer time', () => {
    const base = outbox();
    const legacy = { ...settingsAt(4), learn: { ...settingsAt(4).learn, targetMs: 1500 } };
    const batch = readOutbox({ ...base, request: { ...base.request, settings: legacy } });
    expect(batch?.seq).toBe(1);
    expect(batch?.request.settings).toEqual(settingsAt(4));
    expect(batch?.request.log).toEqual(base.request.log);
  });

  it('rejects an outbox of format 2', () => {
    const old = outbox();
    expect(readOutbox({ ...old, request: { ...old.request, v: 2 } })).toBeNull();
  });

  it('knows the last `n` of a batch', () => {
    const batch = readOutbox(outbox());
    expect(batch === null ? null : lastNOf(batch.request)).toBe(7);
  });
});
