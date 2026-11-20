import { test, expect } from '@playwright/test';
import {
  chooseAccount,
  expectSyncStatus,
  playLearningSession,
  sessionsLine,
  signIn,
  uniqueUser,
} from '../lib/sync';

test.describe('a guest signs in (storage-sync.md, "Guest, sign-in and sign-out")', () => {
  test('the learning of a guest reaches the account and shows on a new device', async ({
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
    await expect(sessionsLine(device)).toContainText('1 started · 1 finished');
    await other.close();
  });
});
