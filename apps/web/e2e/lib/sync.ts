import { expect } from '@playwright/test';
import type { BrowserContext, Locator, Page } from '@playwright/test';
import { answer } from './learn';

/** A name no other test of the run uses: the database of the sync server lives for the whole run. */
export function uniqueUser(prefix: string): string {
  return `${prefix}-${crypto.randomUUID().slice(0, 8)}`;
}

/** Makes the fake provider answer as `user`: the next sign-in of this context is that account. */
export async function chooseAccount(context: BrowserContext, user: string): Promise<void> {
  await context.addCookies([{ name: 'e2e_user', value: user, url: 'http://localhost:5274' }]);
}

/**
 * Presses the real sign-in button on `/settings`, comes back from the fake provider to `/` and
 * opens the account section.
 */
export async function signIn(page: Page, user: string): Promise<void> {
  await chooseAccount(page.context(), user);
  await page.goto('/settings');
  await page.getByRole('button', { name: 'sign in with Google' }).click();
  await page.waitForURL('/');
  await expect(page.getByTestId('learn-mastered-count')).toBeVisible();
  await page.getByRole('link', { name: 'settings', exact: true }).click();
  await expect(page.getByTestId('account-name')).toHaveText(user);
}

/** The sync status line of the account section on `/settings`. */
export async function expectSyncStatus(page: Page, status: string): Promise<void> {
  await expect(
    page.getByRole('status').filter({ hasText: /^(synced|pending|offline)/ }),
  ).toHaveText(status);
}

/** Plays the 25 tasks of the learning session on screen, correctly, up to its summary. */
export async function answerSession(page: Page): Promise<void> {
  for (let n = 1; n <= 25; n++) {
    await expect(page.getByTestId('task-session')).toHaveText(`learning · ${String(n)} of 25`);
    await answer(page, false);
  }
  await expect(page.getByRole('heading', { name: 'session summary' })).toBeVisible();
}

/** One learning session of 25 tasks on `/`, started from the table and played correctly. */
export async function playLearningSession(page: Page): Promise<void> {
  await page.goto('/');
  await expect(page.getByTestId('learn-mastered-count')).toBeVisible();
  await page.getByRole('button', { name: 'continue' }).click();
  await answerSession(page);
}

/** The sessions line of `/stats`, which the other device reads (`learning sessions: …`). */
export function sessionsLine(page: Page): Locator {
  return page.getByTestId('stats-sessions');
}
