import { test, expect } from '@playwright/test';
import type { Page } from '@playwright/test';
import { canonicalOfPrompt } from './lib/prompt';

const RESULTS_CHUNK = '**/assets/results-panel-*.js';
const RU_CHUNK = '**/assets/ru-*.js';

/** Ends a zen test with one prompt typed, by the Finish button. */
async function finishZen(page: Page): Promise<void> {
  await page.goto('/type');
  await page.getByRole('radio', { name: 'Zen' }).click();
  await page.keyboard.type(await canonicalOfPrompt(page), { delay: 15 });
  await page.getByRole('button', { name: /^finish/ }).click();
}

test.describe('the results screen is a lazy chunk', () => {
  test('a delayed chunk shows a notice, and Next test and Enter work meanwhile', async ({
    page,
  }) => {
    await page.route(RESULTS_CHUNK, async (route) => {
      await new Promise((resolve) => setTimeout(resolve, 1500));
      await route.continue();
    });
    await finishZen(page);

    await expect(page.getByRole('status').filter({ hasText: 'Loading' })).toBeVisible();
    await expect(page.getByTestId('results-pending')).toBeFocused();
    await page.keyboard.press('Enter');
    await expect(page.getByTestId('prompt-arena')).toHaveAttribute('data-phase', 'idle');
  });

  test('a failed chunk offers Retry and a working Next test', async ({ page }) => {
    let failing = true;
    await page.route(RESULTS_CHUNK, async (route) => {
      if (failing) {
        await route.abort();
        return;
      }
      await route.continue();
    });
    await finishZen(page);

    await expect(page.getByRole('alert')).toBeVisible();
    failing = false;
    await page.getByRole('button', { name: 'retry' }).click();
    await expect(page.getByTestId('results-panel')).toBeVisible();
  });

  test('a failed chunk does not trap the user: Next test starts again', async ({ page }) => {
    await page.route(RESULTS_CHUNK, (route) => route.abort());
    await finishZen(page);

    await expect(page.getByRole('alert')).toBeVisible();
    await page.getByRole('button', { name: 'next test' }).click();
    await expect(page.getByTestId('prompt-arena')).toHaveAttribute('data-phase', 'idle');
  });

  test('after the idle prefetch the results and the language work without the network', async ({
    page,
    context,
  }) => {
    const results = page.waitForResponse(/assets\/results-panel-.*\.js/);
    const ru = page.waitForResponse(/assets\/ru-.*\.js/);
    await page.goto('/type');
    await Promise.all([results, ru]);

    await context.setOffline(true);
    await page.getByRole('button', { name: 'ru', exact: true }).click();
    await expect(page.getByRole('radio', { name: 'Хирагана' })).toBeVisible();
    await page.getByRole('radio', { name: 'zen' }).click();
    await page.keyboard.type(await canonicalOfPrompt(page), { delay: 15 });
    await page.getByRole('button', { name: /^завершить/ }).click();
    await expect(page.getByTestId('results-panel')).toBeVisible();
  });
});

test.describe('the Russian dictionary is a lazy chunk', () => {
  test.beforeEach(async ({ page }) => {
    await page.addInitScript(() => {
      localStorage.setItem('nekotype:locale', 'ru');
    });
  });

  test('a saved Russian choice waits for the dictionary: no English flash', async ({ page }) => {
    await page.route(RU_CHUNK, async (route) => {
      await new Promise((resolve) => setTimeout(resolve, 1200));
      await route.continue();
    });
    await page.goto('/type');
    await page.waitForTimeout(500);
    await expect(page.locator('#app nav')).toHaveCount(0);

    await expect(page.getByRole('radio', { name: 'Хирагана' })).toBeVisible();
    await expect(page.locator('html')).toHaveAttribute('lang', 'ru');
  });

  test('a failed dictionary falls back to English and keeps the saved choice', async ({ page }) => {
    await page.route(RU_CHUNK, (route) => route.abort());
    await page.goto('/type');

    await expect(page.getByRole('radio', { name: 'Hiragana' })).toBeVisible();
    await expect(page.locator('html')).toHaveAttribute('lang', 'en');
    expect(await page.evaluate(() => localStorage.getItem('nekotype:locale'))).toBe('ru');
  });
});
