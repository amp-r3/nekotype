import { test, expect } from '@playwright/test';
import { seedLog } from './lib/app';
import { learnedLog } from './lib/kana';
import { answer } from './lib/learn';

test.describe('learning session on /', () => {
  test('a full session of 30 tasks ends on the summary @mobile', async ({ page, isMobile }) => {
    await page.goto('/');
    await expect(page.getByTestId('learn-mastered-count')).toBeVisible();
    await page.getByRole('button', { name: 'continue' }).click();

    // The navigation is not drawn during a session.
    await expect(page.getByRole('navigation')).toHaveCount(0);

    for (let n = 1; n <= 30; n++) {
      await expect(page.getByTestId('task-session')).toHaveText(`learning · ${String(n)} of 30`);
      // Keys pressed before the task is shown are ignored; the task is on screen now.
      await answer(page, isMobile);
    }

    await expect(page.getByRole('heading', { name: 'session summary' })).toBeVisible();
    await expect(page.getByRole('navigation')).toBeVisible();
    // The first session introduces kana, so there is something to show or the line.
    await expect(page.getByRole('button', { name: /continue/ })).toBeVisible();
    // Enter from the hidden field starts the next session (the table button has a unit test).
    await page.keyboard.press('Enter');
    await expect(page.getByTestId('task-session')).toHaveText('learning · 1 of 30');
    await page.getByRole('button', { name: 'leave session' }).click();
    await expect(page.getByTestId('learn-mastered-count')).toBeVisible();
  });

  test('leaving a session returns to the table and keeps the introduced kana', async ({ page }) => {
    await page.goto('/');
    await page.getByRole('button', { name: 'continue' }).click();
    await expect(page.getByTestId('kana-task')).toHaveAttribute('data-kind', 'introduction');
    await answer(page, false);
    await expect(page.getByTestId('task-session')).toHaveText('learning · 2 of 30');
    await page.getByRole('button', { name: 'leave session' }).click();
    await expect(page.getByTestId('learn-mastered-count')).toBeVisible();
    await expect(page.getByRole('navigation')).toBeVisible();
  });
});

test.describe('review in a session on /', () => {
  test('takes the due kana first, shows it in the progress line and clears it after', async ({
    page,
  }) => {
    await seedLog(page, '/', learnedLog(['あ'], 30 * 864e5));
    await expect(page.getByTestId('learn-due')).toHaveText('due: 1');
    await expect(page.getByRole('button', { name: /^review/ })).toHaveCount(0);
    await page.getByRole('button', { name: 'continue' }).click();

    await expect(page.getByTestId('task-session')).toHaveText('learning · 1 of 30');
    await expect(page.getByTestId('kana-task')).toHaveAttribute('data-kind', 'recall');
    await answer(page, false);
    await expect(page.getByTestId('task-session')).toHaveText('learning · 2 of 30');

    await page.getByRole('button', { name: 'leave session' }).click();
    // The review moved the kana a long way ahead, so nothing is due now.
    await expect(page.getByTestId('learn-mastered-count')).toBeVisible();
    await expect(page.getByTestId('learn-due')).toHaveCount(0);
  });
});
