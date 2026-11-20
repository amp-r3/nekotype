import { test, expect } from '@playwright/test';
import { playLearningSession } from './lib/sync';

const RU_CHUNK = '**/assets/ru-*.js';

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
    await page.goto('/');
    await page.waitForTimeout(500);
    await expect(page.locator('#app nav')).toHaveCount(0);

    await expect(
      page.getByRole('navigation').getByRole('link', { name: 'обучение' }),
    ).toBeVisible();
    await expect(page.locator('html')).toHaveAttribute('lang', 'ru');
  });

  test('a failed dictionary falls back to English and keeps the saved choice', async ({ page }) => {
    await page.route(RU_CHUNK, (route) => route.abort());
    await page.goto('/');

    await expect(page.getByRole('navigation').getByRole('link', { name: 'learn' })).toBeVisible();
    await expect(page.locator('html')).toHaveAttribute('lang', 'en');
    expect(await page.evaluate(() => localStorage.getItem('nekotype:locale'))).toBe('ru');
  });
});

test.describe('the sync engine is for signed-in users', () => {
  test('a guest makes no request to /api and loads no sync chunk, also after the idle prefetch', async ({
    page,
  }) => {
    const paths: string[] = [];
    page.on('request', (request) => {
      paths.push(new URL(request.url()).pathname);
    });
    await page.goto('/settings');
    await playLearningSession(page);
    // Past the idle prefetch (a 1.5 s timer where there is no requestIdleCallback) and the 10 s
    // wait of a sync after a session would be much longer: the engine must not even be loaded.
    await page.waitForTimeout(3000);

    expect(paths.filter((path) => path.startsWith('/api'))).toEqual([]);
    expect(
      paths.filter((path) => /\/assets\/(sync-(?!request-)|account-panel-)/.test(path)),
    ).toEqual([]);
  });
});
