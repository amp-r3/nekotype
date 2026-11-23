import { describe, expect, it } from 'vitest';
import { decodePage } from '@nekotype/shared/runtime';
import { LOG_DEV, eventsOf, settingsAt } from '../model/test-util';
import { bodyBytes, buildBatch } from './build-batch';
import type { BatchInput } from './build-batch';

const input = (over: Partial<BatchInput> = {}): BatchInput => ({
  deviceId: 'dev',
  seq: 4,
  after: 9,
  unsent: [],
  firstN: 1,
  settings: null,
  ...over,
});

describe('buildBatch', () => {
  it('returns null when there is nothing to send', () => {
    expect(buildBatch(input(), 1_000_000)).toBeNull();
  });

  it('carries the events, `after` and the identity', () => {
    const unsent = eventsOf(LOG_DEV, 3, 4);
    const batch = buildBatch(input({ unsent, firstN: 3 }), 1_000_000);
    expect(batch?.request).toMatchObject({
      v: 3,
      deviceId: 'dev',
      seq: 4,
      after: 9,
      settings: null,
    });
    expect(decodePage(batch?.request.log)).toEqual(unsent);
    expect(batch?.lastN).toBe(6);
  });

  it('sends only the run that starts at the first unsent n', () => {
    // Events 1–2 are missing from the read (a page closed between two reads): nothing is sent, so
    // `sentN` never jumps over them.
    const late = eventsOf(LOG_DEV, 3, 4);
    expect(buildBatch(input({ unsent: late, firstN: 1 }), 1_000_000)).toBeNull();
    const gap = [...eventsOf(LOG_DEV, 1, 2), ...eventsOf(LOG_DEV, 5, 2)];
    const batch = buildBatch(input({ unsent: gap, firstN: 1 }), 1_000_000);
    expect(batch?.lastN).toBe(2);
    expect(batch?.request.log?.e).toHaveLength(2);
  });

  it('sends settings alone', () => {
    const batch = buildBatch(input({ settings: settingsAt(5) }), 1_000_000);
    expect(batch?.request.log).toBeNull();
    expect(batch?.request.settings?.updatedAt).toBe(5);
    expect(batch?.lastN).toBeNull();
  });

  it('takes the longest prefix that fits', () => {
    const unsent = eventsOf(LOG_DEV, 1, 400);
    const limit = 6000;
    const batch = buildBatch(input({ unsent }), limit);
    const count = batch?.request.log?.e.length ?? 0;
    expect(count).toBeGreaterThan(10);
    expect(count).toBeLessThan(400);
    expect(bodyBytes(JSON.stringify(batch?.request))).toBeLessThanOrEqual(limit);
    // One more event would not fit.
    const more = buildBatch(input({ unsent: unsent.slice(0, count + 1) }), limit * 100);
    expect(bodyBytes(JSON.stringify(more?.request))).toBeGreaterThan(limit);
    expect(batch?.lastN).toBe(count);
  });

  it('never takes more than the events of a page', () => {
    const batch = buildBatch(input({ unsent: eventsOf(LOG_DEV, 1, 9000) }), 100_000_000);
    expect(batch?.request.log?.e.length).toBe(8192);
  });

  it('falls back to the settings when not even one event fits', () => {
    const unsent = eventsOf(LOG_DEV, 1, 3);
    const alone = buildBatch(input({ settings: settingsAt(5) }), 1_000_000);
    const tight = bodyBytes(JSON.stringify(alone?.request));
    const batch = buildBatch(input({ unsent, settings: settingsAt(5) }), tight);
    expect(batch?.request.log).toBeNull();
    expect(batch?.request.settings).not.toBeNull();
    expect(buildBatch(input({ unsent }), 10)).toBeNull();
  });
});
