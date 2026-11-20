import { test, expect } from '@playwright/test';
import {
  answerSession,
  expectSyncStatus,
  playLearningSession,
  sessionsLine,
  signIn,
  uniqueUser,
} from '../lib/sync';

test.describe('a session answered offline (storage-sync.md, "Sync triggers")', () => {
  test('stays on the device, then arrives when the connection returns', async ({
    page,
    context,
    browser,
  }) => {
    const user = uniqueUser('offline');
    // The client sends at most one request per 10 seconds: the clock jumps over the wait.
    await page.clock.install();
    await signIn(page, user);
    await expectSyncStatus(page, 'synced');

    // A first session while the connection is there: it loads the lazy chunks of the session and
    // its summary, which the second one needs offline.
    await playLearningSession(page);
    await page.clock.fastForward(10_000);
    await page.getByRole('link', { name: 'settings', exact: true }).click();
    await expectSyncStatus(page, 'synced');
    await page.getByRole('link', { name: 'learn', exact: true }).click();
    await expect(page.getByTestId('learn-mastered-count')).toBeVisible();

    await context.setOffline(true);
    await page.getByRole('button', { name: 'continue' }).click();
    await answerSession(page);
    await page.getByRole('link', { name: 'settings', exact: true }).click();
    await expectSyncStatus(page, 'offline');

    await context.setOffline(false);
    await page.clock.fastForward(10_000);
    await expectSyncStatus(page, 'synced');

    // Another browser of the same account sees both sessions in its counters.
    const other = await browser.newContext();
    const device = await other.newPage();
    await signIn(device, user);
    await expectSyncStatus(device, 'synced');
    await device.getByRole('link', { name: 'stats', exact: true }).click();
    await expect(sessionsLine(device)).toContainText('2 started · 2 finished');
    await other.close();
  });
});
