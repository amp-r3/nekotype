import { test, expect } from '@playwright/test';

test.describe('routes: direct visits, navigation without a reload, settings', () => {
  // The other screens and the unknown path are covered without a browser (app/App.test.tsx,
  // app/init.test.ts); one direct visit is left to show that the production bundle and the server's
  // fallback to the entry page work together.
  test('/settings opens from its address', async ({ page }) => {
    await page.goto('/settings');
    await expect(page.getByRole('heading', { level: 1, name: 'Settings' })).toBeVisible();
    await expect(page).toHaveTitle('Settings — Nekotype');
  });

  // The preview server ignores `_redirects`; the router follows `ROUTE_REDIRECTS` on its own, which
  // also covers a stale copy of the entry page at the edge. The 301 itself is the smoke test's.
  test('/stats leads to /progress, with and without the trailing slash', async ({ page }) => {
    for (const path of ['/stats', '/stats/']) {
      await page.goto(path);
      await expect(page).toHaveURL(/\/progress$/);
      await expect(page.getByRole('heading', { level: 1, name: 'Progress' })).toBeVisible();
    }
  });

  // The preview server falls back to the entry page for every path; the real 404 status of
  // /learn and /type on Pages is checked by the deployment smoke test (scripts/smoke-deploy.mjs).
  test('/learn and /type are gone: they show the not-found screen', async ({ page }) => {
    for (const path of ['/learn', '/type']) {
      await page.goto(path);
      await expect(page.getByRole('heading', { level: 1, name: 'Page not found' })).toBeVisible();
    }
  });

  // On Pages an unknown path is answered with the static 404.html, not the application (ADR 077).
  test('the static 404 page shows the cat, follows the saved language and links home', async ({
    page,
  }) => {
    await page.goto('/404.html');
    await expect(page.getByRole('heading', { level: 1, name: 'Page not found' })).toBeVisible();
    await expect(page.getByRole('link', { name: /^go home/ })).toHaveAttribute('href', '/');

    await page.evaluate(() => {
      localStorage.setItem('nekotype:locale', 'ru');
    });
    await page.reload();
    await expect(
      page.getByRole('heading', { level: 1, name: 'Страница не найдена' }),
    ).toBeVisible();
    await expect(page.locator('html')).toHaveAttribute('lang', 'ru');
  });

  test('Enter on the not-found screen goes home', async ({ page }) => {
    await page.goto('/nope');
    await expect(page.getByRole('button', { name: /^go home/ })).toBeVisible();
    await page.keyboard.press('Enter');
    await expect(page).toHaveURL(/\/$/);
  });

  test('navigation does not reload the page, and Back returns to a working learning screen', async ({
    page,
  }) => {
    await page.goto('/');
    await expect(page.getByTestId('home-reason')).toBeVisible();
    await page.evaluate(() => {
      Object.assign(window, { navigationMarker: 'kept' });
    });

    await page.getByRole('navigation').getByRole('link', { name: 'progress' }).click();
    await expect(page).toHaveURL(/\/progress$/);
    await expect(page.getByRole('heading', { level: 1, name: 'Progress' })).toBeVisible();
    await expect(page.getByRole('link', { name: 'progress' })).toHaveAttribute(
      'aria-current',
      'page',
    );

    await page.getByRole('link', { name: 'about' }).click();
    await expect(page.getByRole('heading', { level: 1, name: 'About' })).toBeVisible();

    await page.goBack();
    await expect(page.getByRole('heading', { level: 1, name: 'Progress' })).toBeVisible();
    await page.goBack();
    await expect(page).toHaveURL(/\/$/);
    await expect(page.getByTestId('home-reason')).toBeVisible();

    // No document load happened on the way.
    expect(await page.evaluate(() => Reflect.get(window, 'navigationMarker'))).toBe('kept');

    // The learning screen works after coming back: a session starts and takes the keyboard.
    await page.getByRole('button', { name: 'continue' }).click();
    await expect(page.getByTestId('kana-task')).toBeVisible();
    await expect(page.locator('input[aria-label="Kana answer input"]')).toBeFocused();
  });

  test('settings: Reset progress asks for confirmation and can be cancelled', async ({ page }) => {
    await page.goto('/settings');
    await page.getByRole('button', { name: 'reset', exact: true }).click();

    const dialog = page.locator('dialog[open]');
    await expect(dialog).toBeVisible();
    await expect(dialog).toContainText('This cannot be undone');
    await dialog.getByRole('button', { name: 'cancel', exact: true }).click();
    await expect(page.locator('dialog[open]')).toHaveCount(0);

    await page.getByRole('button', { name: 'reset', exact: true }).click();
    await page.locator('dialog[open]').getByRole('button', { name: 'reset', exact: true }).click();
    await expect(page.locator('dialog[open]')).toHaveCount(0);
  });

  test('the language switch is in the navigation on every screen', async ({ page }) => {
    await page.goto('/about');
    await page.getByRole('button', { name: 'ru', exact: true }).click();
    await expect(page.getByRole('heading', { level: 1, name: 'О проекте' })).toBeVisible();
    await expect(page).toHaveTitle('О проекте — Nekotype');
    await page.getByRole('button', { name: 'en', exact: true }).click();
    await expect(page.getByRole('heading', { level: 1, name: 'About' })).toBeVisible();
  });
});
