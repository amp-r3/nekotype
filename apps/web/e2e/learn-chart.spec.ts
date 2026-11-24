import { test, expect } from '@playwright/test';
import { seedLog } from './lib/app';
import { learnedLog } from './lib/kana';

test.describe('kana chart on /', () => {
  test('a fresh start draws every kana locked, and a locked kana has no details', async ({
    page,
  }) => {
    await page.goto('/');
    await expect(page.getByTestId('learn-mastered-count')).toBeVisible();
    await expect(page.locator('[data-testid="kana-cell"]:not([data-state="locked"])')).toHaveCount(
      0,
    );
    await page.getByTestId('kana-cell').first().click({ force: true });
    await expect(page.locator('dialog[open]')).toHaveCount(0);
  });

  test('the tooltip does not stay after the details are closed with the mouse', async ({
    page,
  }) => {
    // あ learned a minute ago: a learned kana, so its cell opens the details.
    await seedLog(page, '/', learnedLog(['あ'], 5 * 60_000));
    await expect(page.getByTestId('learn-mastered-count')).toBeVisible();
    const cell = page.getByTestId('kana-cell').first();
    await expect(cell).toHaveAttribute('data-state', 'learned');
    await cell.click();
    await expect(page.getByTestId('kana-details')).toBeVisible();
    await expect(page.getByTestId('kana-details')).toContainText('learned');
    await page.getByRole('button', { name: 'close' }).click();
    await expect(page.locator('dialog[open]')).toHaveCount(0);

    await page.mouse.move(5, 5);
    await expect(page.getByTestId('kana-tooltip')).toHaveCount(0);
    await page.mouse.move(5, 500);
    await expect(page.getByTestId('kana-tooltip')).toHaveCount(0);
  });
});
