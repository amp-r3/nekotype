import { test, expect } from '@playwright/test';
import {
  chooseAccount,
  expectSyncStatus,
  playLearningSession,
  sessionCounts,
  signIn,
  uniqueUser,
} from '../lib/sync';

test.describe('a guest signs in (storage-sync.md, "Guest, sign-in and sign-out")', () => {
  // Off until PR 11 of P7: sessions are recorded in the log now, while the sync engine and `/stats`
  // still read the old store (P7 plan, D21). PR 11 turns this back on with the sync of format 3.
  test.fixme('the learning of a guest reaches the account and shows on a new device', async ({
    page,
    browser,
  }) => {
    const user = uniqueUser('guest');

    await playLearningSession(page);

    await signIn(page, user);
    await expectSyncStatus(page, 'synced');

    // A fresh browser has no data: the same account shows the session.
    const other = await browser.newContext();
    const device = await other.newPage();
    await chooseAccount(other, user);
    await signIn(device, user);
    await expectSyncStatus(device, 'synced');

    await device.goto('/stats');
    const counts = sessionCounts(device);
    await expect(counts.started).toHaveText('1');
    await expect(counts.finished).toHaveText('1');
    await other.close();
  });
});
