import { expect } from '@playwright/test';
import type { BrowserContext, Page } from '@playwright/test';
import { answer } from './learn';
import { canonicalOfPrompt } from './prompt';

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

/** One learning session of 25 tasks on `/`, played correctly. */
export async function playLearningSession(page: Page): Promise<void> {
  await page.goto('/');
  await expect(page.getByTestId('learn-mastered-count')).toBeVisible();
  await page.getByRole('button', { name: 'continue' }).click();
  for (let n = 1; n <= 25; n++) {
    await expect(page.getByTestId('task-session')).toHaveText(`learning · ${String(n)} of 25`);
    await answer(page, false);
  }
  await expect(page.getByRole('heading', { name: 'session summary' })).toBeVisible();
}

/** Types the prompts of a count test on `/type`, one after another, until the results show. */
export async function typeCountTest(page: Page, prompts: number): Promise<void> {
  for (let i = 0; i < prompts; i++) {
    const canonical = await canonicalOfPrompt(page);
    const glyph = await page.getByTestId('prompt-text').innerText();
    await page.keyboard.type(canonical, { delay: 10 });
    if (i < prompts - 1) {
      await expect(page.getByTestId('prompt-text')).not.toHaveText(glyph, { timeout: 2000 });
    }
  }
  await expect(page.getByTestId('results-panel').getByTestId('mode-line')).toBeVisible();
}
