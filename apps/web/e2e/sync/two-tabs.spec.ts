import { test, expect } from '@playwright/test';
import { seedSettings } from '../lib/app';
import { expectSyncStatus, signIn, typeCountTest, uniqueUser } from '../lib/sync';

test.describe('two tabs of one device (storage-sync.md, "Batches")', () => {
  test('finish work at the same time: nothing is lost and nothing is counted twice', async ({
    page,
    context,
    browser,
  }) => {
    const user = uniqueUser('tabs');
    await page.clock.install();
    await seedSettings(page, {
      typing: { script: 'hiragana', test: { kind: 'count', prompts: 10 } },
    });
    await signIn(page, user);
    await expectSyncStatus(page, 'synced');

    // The ids of the results every request of the context carries.
    const sent: string[] = [];
    context.on('request', (request) => {
      if (request.method() !== 'POST' || new URL(request.url()).pathname !== '/api/sync') return;
      const body: unknown = request.postDataJSON();
      const results =
        typeof body === 'object' && body !== null && 'results' in body ? body.results : [];
      if (!Array.isArray(results)) return;
      for (const result of results) {
        if (typeof result === 'object' && result !== null && 'id' in result) {
          sent.push(String(result.id));
        }
      }
    });

    const second = await context.newPage();
    await second.clock.install();
    await second.goto('/type');
    await page.getByRole('link', { name: 'type', exact: true }).click();
    await expect(page.getByTestId('prompt-arena')).toBeVisible();
    await expect(second.getByTestId('prompt-arena')).toBeVisible();

    await Promise.all([typeCountTest(page, 10), typeCountTest(second, 10)]);

    // Both tabs wait 10 seconds after their test, then ask for the lock.
    await Promise.all([page.clock.fastForward(10_000), second.clock.fastForward(10_000)]);
    await page.getByRole('link', { name: 'settings', exact: true }).click();
    await expectSyncStatus(page, 'synced');

    // Two tests, each sent once.
    expect(new Set(sent).size).toBe(2);
    expect(sent).toHaveLength(2);

    const other = await browser.newContext();
    const device = await other.newPage();
    await signIn(device, user);
    await expectSyncStatus(device, 'synced');
    await device.getByRole('link', { name: 'stats', exact: true }).click();
    await expect(device.getByTestId('stats-typing-tests')).toContainText('2 finished');
    await other.close();
  });
});
