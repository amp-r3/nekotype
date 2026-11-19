import { test, expect } from '@playwright/test';
import { seedSettings } from '../lib/app';
import { expectSyncStatus, signIn, typeCountTest, uniqueUser } from '../lib/sync';

test.describe('a test finished offline (storage-sync.md, "Sync triggers")', () => {
  test('stays visible on the device, then arrives when the connection returns', async ({
    page,
    context,
    browser,
  }) => {
    const user = uniqueUser('offline');
    // The client sends at most one request per 10 seconds: the clock jumps over the wait.
    await page.clock.install();
    await seedSettings(page, {
      typing: { script: 'hiragana', test: { kind: 'count', prompts: 10 } },
    });
    await signIn(page, user);
    await expectSyncStatus(page, 'synced');

    // The lazy chunks of the screens are loaded while the connection is there.
    await page.getByRole('link', { name: 'stats', exact: true }).click();
    await expect(page.getByRole('heading', { name: 'Stats', level: 1 })).toBeVisible();
    await page.getByRole('link', { name: 'type', exact: true }).click();
    await expect(page.getByTestId('prompt-arena')).toBeVisible();

    await context.setOffline(true);
    await typeCountTest(page, 10);
    await page.getByRole('link', { name: 'stats', exact: true }).click();
    await page.getByRole('radio', { name: 'typing', exact: true }).check();
    await expect(page.getByTestId('history-row')).toHaveCount(1);
    await page.getByRole('link', { name: 'settings', exact: true }).click();
    await expectSyncStatus(page, 'offline');

    await context.setOffline(false);
    await page.clock.fastForward(10_000);
    await expectSyncStatus(page, 'synced');

    // Another browser of the same account sees the test in its counters.
    const other = await browser.newContext();
    const device = await other.newPage();
    await signIn(device, user);
    await expectSyncStatus(device, 'synced');
    await device.getByRole('link', { name: 'stats', exact: true }).click();
    await expect(device.getByTestId('stats-typing-tests')).toContainText('1 finished');
    await other.close();
  });
});
