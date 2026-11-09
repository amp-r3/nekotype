import { test, expect } from '@playwright/test';

test.describe('kana chart on /', () => {
  test('the tooltip does not stay after the details are closed with the mouse', async ({
    page,
  }) => {
    await page.goto('/');
    await expect(page.getByTestId('learn-mastered-count')).toBeVisible();
    await page.getByTestId('kana-cell').first().click();
    await expect(page.getByTestId('kana-details')).toBeVisible();
    await page.getByRole('button', { name: 'close' }).click();
    await expect(page.getByTestId('kana-details')).toHaveCount(0);

    await page.mouse.move(5, 5);
    await expect(page.getByTestId('kana-tooltip')).toHaveCount(0);
    await page.mouse.move(5, 500);
    await expect(page.getByTestId('kana-tooltip')).toHaveCount(0);
  });
});
