import { test, expect } from '@playwright/test';

test.describe('the interface language', () => {
  test('(g) RU/EN switch changes a visible label and survives a reload', async ({ page }) => {
    await page.goto('/');

    // Check the initial English label of the navigation
    const learn = page.getByRole('navigation').getByRole('link', { name: 'learn' });
    await expect(learn).toBeVisible();

    // Switch to Russian locale
    const ruButton = page.getByRole('button', { name: 'ru', exact: true });
    await ruButton.click();
    await expect(ruButton).toHaveAttribute('aria-pressed', 'true');

    // The label updates to Russian
    await expect(
      page.getByRole('navigation').getByRole('link', { name: 'обучение' }),
    ).toBeVisible();
    await expect(page.locator('html')).toHaveAttribute('lang', 'ru');

    // Reload page
    await page.reload();

    // Label and lang attribute persist across reload
    await expect(
      page.getByRole('navigation').getByRole('link', { name: 'обучение' }),
    ).toBeVisible();
    await expect(page.locator('html')).toHaveAttribute('lang', 'ru');

    // Clean up: switch back to English
    const enButton = page.getByRole('button', { name: 'en', exact: true });
    await enButton.click();
    await expect(page.getByRole('navigation').getByRole('link', { name: 'learn' })).toBeVisible();
  });
});
