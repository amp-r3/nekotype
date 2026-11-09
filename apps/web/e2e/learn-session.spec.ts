import { test, expect } from '@playwright/test';
import type { Page } from '@playwright/test';
import { allKanaRows } from '@nekotype/engine';
import { seedLearning } from './lib/app';

// The romaji the page asks for or accepts, worked out from what the page shows (ADR 045): the kana
// on screen, through the kana table.
const romajiOf = new Map<string, string>();
for (const row of allKanaRows) {
  for (const entry of row.entries) {
    const romaji = entry.ime[0];
    if (romaji === undefined) continue;
    if (entry.hiragana !== undefined) romajiOf.set(entry.hiragana, romaji);
    romajiOf.set(entry.katakana, romaji);
  }
}

async function text(page: Page, selector: string): Promise<string> {
  return (await page.locator(selector).first().textContent()) ?? '';
}

// Plays one task of whatever kind is on screen, correctly.
async function answer(page: Page, tapOptions: boolean): Promise<void> {
  const task = page.getByTestId('kana-task');
  const kind = await task.getAttribute('data-kind');
  if (kind === 'introduction') {
    const hint = await page.locator('.nk-task__ghost').getAttribute('aria-label');
    await page.keyboard.type(hint ?? '');
  } else if (kind === 'recall') {
    const romaji = romajiOf.get(await text(page, '[data-task-kana]'));
    expect(romaji).toBeDefined();
    await page.keyboard.type(romaji ?? '');
  } else {
    const wanted = await text(page, '[data-testid="task-prompt"]');
    const options = page.locator('.nk-opt');
    const labels = await options.locator('.nk-opt__label').allTextContents();
    const index = labels.findIndex((label) => romajiOf.get(label) === wanted);
    expect(index).toBeGreaterThanOrEqual(0);
    if (tapOptions) await options.nth(index).click();
    else await page.keyboard.press(`Digit${String(index + 1)}`);
  }
}

test.describe('learning session on /', () => {
  test('a full session of 25 tasks ends on the summary @mobile', async ({ page, isMobile }) => {
    await page.goto('/');
    await expect(page.getByTestId('learn-mastered-count')).toBeVisible();
    await page.getByRole('button', { name: 'Continue' }).click();

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
    await page.getByRole('button', { name: 'to the table' }).click();
    await expect(page.getByTestId('learn-mastered-count')).toBeVisible();
  });

  test('leaving a session returns to the table and keeps the introduced kana', async ({ page }) => {
    await page.goto('/');
    await page.getByRole('button', { name: 'Continue' }).click();
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
    const review = page.getByRole('button', { name: 'Review (1)' });
    await expect(review).toBeEnabled();
    await review.click();

    await expect(page.getByTestId('task-session')).toHaveText('review · 1 of 1');
    await expect(page.getByTestId('kana-task')).toHaveAttribute('data-kind', 'recall');
    await answer(page, false);

    await expect(page.getByRole('heading', { name: 'session summary' })).toBeVisible();
    await page.getByRole('button', { name: 'to the table' }).click();
    // The kana moved to box 3, so it is not due any more.
    await expect(page.getByRole('button', { name: 'Review (0)' })).toBeDisabled();
  });
});
