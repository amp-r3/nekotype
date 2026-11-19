import { test, expect } from '@playwright/test';
import { seedLearning } from './lib/app';
import { answer } from './lib/learn';

test.describe('learning session on /', () => {
  test('a full session of 25 tasks ends on the summary @mobile', async ({ page, isMobile }) => {
    await page.goto('/');
    await expect(page.getByTestId('learn-mastered-count')).toBeVisible();
    await page.getByRole('button', { name: 'continue' }).click();

    // The navigation is not drawn during a session.
    await expect(page.getByRole('navigation')).toHaveCount(0);

    for (let n = 1; n <= 25; n++) {
      await expect(page.getByTestId('task-session')).toHaveText(`learning · ${String(n)} of 25`);
      // Keys pressed before the task is shown are ignored; the task is on screen now.
      await answer(page, isMobile);
    }

    await expect(page.getByRole('heading', { name: 'session summary' })).toBeVisible();
    await expect(page.getByRole('navigation')).toBeVisible();
    // The first session introduces the five vowels, so there is something to show or the line.
    await expect(page.getByRole('button', { name: /continue/ })).toBeVisible();
    // Enter from the hidden field starts the next session (the table button has a unit test).
    await page.keyboard.press('Enter');
    await expect(page.getByTestId('task-session')).toHaveText('learning · 1 of 25');
    await page.getByRole('button', { name: 'leave session' }).click();
    await expect(page.getByTestId('learn-mastered-count')).toBeVisible();
  });

  test('leaving a session returns to the table and keeps the introduced kana', async ({ page }) => {
    await page.goto('/');
    await page.getByRole('button', { name: 'continue' }).click();
    await expect(page.getByTestId('kana-task')).toHaveAttribute('data-kind', 'introduction');
    await answer(page, false);
    await expect(page.getByTestId('task-session')).toHaveText('learning · 2 of 25');
    await page.getByRole('button', { name: 'leave session' }).click();
    await expect(page.getByTestId('learn-mastered-count')).toBeVisible();
    await expect(page.getByRole('navigation')).toBeVisible();
  });
});

test.describe('review session on /', () => {
  const unlocked = ['あ', 'い', 'う', 'え', 'お'].map((kana) => `hiragana:${kana}`);
  const learn = {
    unlocked: {
      hiragana: unlocked,
      katakana: unlocked.map((k) => k.replace(/^hiragana/, 'katakana')),
    },
    entries: { 'hiragana:あ': { box: 2, dueAt: 1, updatedAt: 1 } },
    // Confident: only a confident kana is due (ADR 062).
    recent: {
      'hiragana:あ': Array.from({ length: 10 }, (_, i) => ({ at: i + 1, ms: 900, ok: true })),
    },
    stats: {},
    activeDays: [],
    recallBuckets: { hiragana: {}, katakana: {} },
  };

  test('reviews the one due kana and ends on the summary', async ({ page }) => {
    await seedLearning(page, '/', learn);
    const review = page.getByRole('button', { name: 'review (1)' });
    await expect(review).toBeEnabled();
    await review.click();

    await expect(page.getByTestId('task-session')).toHaveText('review · 1 of 1');
    await expect(page.getByTestId('kana-task')).toHaveAttribute('data-kind', 'recall');
    await answer(page, false);

    await expect(page.getByRole('heading', { name: 'session summary' })).toBeVisible();
    await page.getByRole('button', { name: 'to the table' }).click();
    // The kana moved to box 3, so it is not due any more.
    await expect(page.getByRole('button', { name: 'review (0)' })).toBeDisabled();
  });
});
