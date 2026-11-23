import { describe, expect, it } from 'vitest';
import { settingsAt } from '../model/test-util';
import { settingsAfter } from './settings-after';

describe('settingsAfter', () => {
  it('replaces a document that has not changed since the batch with the server one', () => {
    expect(settingsAfter(settingsAt(100), 100, 100, settingsAt(500))).toEqual({
      replace: settingsAt(500),
      syncedAt: 500,
    });
  });

  it('keeps a document that changed after the batch was built', () => {
    expect(settingsAfter(settingsAt(300), 0, 100, settingsAt(100))).toEqual({
      replace: null,
      syncedAt: 100,
    });
  });

  it('does not replace a document that equals the server one', () => {
    expect(settingsAfter(settingsAt(100), 0, 100, settingsAt(100))).toEqual({
      replace: null,
      syncedAt: 100,
    });
  });

  it('takes the account settings when the guest has none', () => {
    expect(settingsAfter(null, 0, null, settingsAt(40))).toEqual({
      replace: settingsAt(40),
      syncedAt: 40,
    });
  });

  it('keeps unsent local settings when a snapshot is read and the batch carried none', () => {
    expect(settingsAfter(settingsAt(300), 100, null, settingsAt(200))).toEqual({
      replace: null,
      syncedAt: 100,
    });
  });

  it('leaves everything when the server has no settings', () => {
    expect(settingsAfter(settingsAt(100), 100, null, null)).toEqual({
      replace: null,
      syncedAt: 100,
    });
  });
});
