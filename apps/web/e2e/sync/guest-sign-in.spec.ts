import { test, expect } from '@playwright/test';
import { seedSettings } from '../lib/app';
import {
  chooseAccount,
  expectSyncStatus,
  playLearningSession,
  signIn,
  typeCountTest,
  uniqueUser,
} from '../lib/sync';

test.describe('a guest signs in (storage-sync.md, "Guest, sign-in and sign-out")', () => {
  test('the learning and the typing of a guest reach the account and show on a new device', async ({
    page,
    browser,
  }) => {
    const user = uniqueUser('guest');

    await playLearningSession(page);
    await seedSettings(page, {
      typing: { script: 'hiragana', test: { kind: 'count', prompts: 10 } },
    });
    await expect(page.getByTestId('prompt-arena')).toBeVisible();
    await typeCountTest(page, 10);

    await signIn(page, user);
    await expectSyncStatus(page, 'synced');

    // A fresh browser has no data: the same account shows both kinds of work.
    const other = await browser.newContext();
    const device = await other.newPage();
    await chooseAccount(other, user);
    await signIn(device, user);
    await expectSyncStatus(device, 'synced');

    // The learning section opens first when there are answers.
    await device.goto('/stats');
    await expect(device.getByTestId('stats-sessions')).toBeVisible();
    await device.getByRole('radio', { name: 'typing', exact: true }).check();
    // The rows of the history are fetched on demand (`GET /api/results`, PR 10); the records and
    // the counters come with the snapshot.
    await expect(device.getByTestId('stats-bests')).toContainText(
      'words · hiragana · relaxed · 10',
    );
    await expect(device.getByTestId('stats-typing-tests')).toContainText('1 finished');
    await other.close();
  });
});
