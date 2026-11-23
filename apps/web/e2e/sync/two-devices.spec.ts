import { test, expect } from '@playwright/test';
import {
  answerSession,
  chartStates,
  expectSyncStatus,
  playLearningSession,
  sessionCounts,
  signIn,
  uniqueUser,
} from '../lib/sync';

test.describe('two devices of one account (storage-sync.md, "Batches")', () => {
  test('one is offline while both answer a session: both converge on the same chart and counts', async ({
    browser,
  }) => {
    // Four sessions of 30 tasks and two sign-ins.
    test.setTimeout(180_000);
    const user = uniqueUser('devices');
    const contextA = await browser.newContext();
    const contextB = await browser.newContext();
    const a = await contextA.newPage();
    const b = await contextB.newPage();
    // The client sends at most one request per 10 seconds: the clocks jump over the wait.
    await a.clock.install();
    await b.clock.install();

    await signIn(a, user);
    await signIn(b, user);
    await expectSyncStatus(a, 'synced');
    await expectSyncStatus(b, 'synced');

    // A first session on each: it loads the lazy chunks of the session, which the offline one needs.
    await playLearningSession(a);
    await a.clock.fastForward(10_000);
    await playLearningSession(b);
    await b.clock.fastForward(10_000);
    // Both sessions reached the server before B goes offline.
    await b.getByRole('link', { name: 'settings', exact: true }).click();
    await expectSyncStatus(b, 'synced');

    // B goes offline and answers a second session; A answers one at the same time.
    await contextB.setOffline(true);
    await b.getByRole('link', { name: 'settings', exact: true }).click();
    await b.getByRole('link', { name: 'learn', exact: true }).click();
    await expect(b.getByTestId('learn-mastered-count')).toBeVisible();
    await b.getByRole('button', { name: 'continue' }).click();
    await answerSession(b);
    await playLearningSession(a);
    await a.clock.fastForward(10_000);

    // B comes back: it sends its session and reads A's.
    await contextB.setOffline(false);
    await b.clock.fastForward(10_000);
    await b.getByRole('link', { name: 'settings', exact: true }).click();
    await expectSyncStatus(b, 'synced');
    await a.clock.fastForward(10_000);
    await a.getByRole('link', { name: 'settings', exact: true }).click();
    await expectSyncStatus(a, 'synced');

    // A reads what B sent when it starts again; the pull and the new fold come after the first paint.
    await a.goto('/');
    await b.goto('/');
    await expect(a.getByTestId('learn-mastered-count')).toBeVisible();
    await expect(b.getByTestId('learn-mastered-count')).toBeVisible();
    await expect
      .poll(async () => (await chartStates(a)).join(',') === (await chartStates(b)).join(','))
      .toBe(true);

    for (const page of [a, b]) {
      await page.goto('/stats');
      const counts = sessionCounts(page);
      await expect(counts.started).toHaveText('4');
      await expect(counts.finished).toHaveText('4');
    }
    await contextA.close();
    await contextB.close();
  });
});
