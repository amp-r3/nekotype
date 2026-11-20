import { test, expect } from '@playwright/test';
import {
  expectSyncStatus,
  playLearningSession,
  sessionsLine,
  signIn,
  uniqueUser,
} from '../lib/sync';

test.describe('two tabs of one device (storage-sync.md, "Batches")', () => {
  test('finish a session at the same time: nothing is lost and nothing is counted twice', async ({
    page,
    context,
    browser,
  }) => {
    const user = uniqueUser('tabs');
    await page.clock.install();
    await signIn(page, user);
    await expectSyncStatus(page, 'synced');

    const second = await context.newPage();
    await second.clock.install();

    await Promise.all([playLearningSession(page), playLearningSession(second)]);

    // Both tabs wait 10 seconds after their session, then ask for the lock.
    await Promise.all([page.clock.fastForward(10_000), second.clock.fastForward(10_000)]);
    await page.getByRole('link', { name: 'settings', exact: true }).click();
    await expectSyncStatus(page, 'synced');

    // Two sessions started and finished, each counted once.
    const other = await browser.newContext();
    const device = await other.newPage();
    await signIn(device, user);
    await expectSyncStatus(device, 'synced');
    await device.getByRole('link', { name: 'stats', exact: true }).click();
    await expect(sessionsLine(device)).toContainText('2 started · 2 finished');
    await other.close();
  });
});
