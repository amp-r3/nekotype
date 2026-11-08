import { test, expect } from '@playwright/test';
import { expectStoredTyping, openTypingScreen, seedSettings } from './lib/app';

test.describe('routes: direct visits, navigation without a reload, settings', () => {
  // The other screens and the unknown path are covered without a browser (app/App.test.tsx,
  // app/init.test.ts); one direct visit is left to show that the production bundle and the server's
  // fallback to the entry page work together.
  test('/settings opens from its address', async ({ page }) => {
    await page.goto('/settings');
    await expect(page.getByRole('heading', { level: 1, name: 'Settings' })).toBeVisible();
    await expect(page).toHaveTitle('Settings — Nekotype');
  });

  // The preview server falls back to the entry page for every path; the real 404 status of
  // /learn on Pages is checked by the deployment smoke test (scripts/smoke-deploy.mjs).
  test('/learn is gone: it shows the not-found screen', async ({ page }) => {
    await page.goto('/learn');
    await expect(page.getByRole('heading', { level: 1, name: 'Page not found' })).toBeVisible();
  });

  test('navigation does not reload the page, and Back returns to a working trainer', async ({
    page,
  }) => {
    await openTypingScreen(page);
    await page.evaluate(() => {
      Object.assign(window, { navigationMarker: 'kept' });
    });

    await page.getByRole('navigation').getByRole('link', { name: 'learn' }).click();
    await expect(page).toHaveURL(/\/$/);
    await expect(page.getByRole('heading', { level: 1, name: 'Learn' })).toBeVisible();
    await expect(page.getByRole('link', { name: 'learn' })).toHaveAttribute('aria-current', 'page');

    await page.getByRole('link', { name: 'about' }).click();
    await expect(page.getByRole('heading', { level: 1, name: 'About' })).toBeVisible();

    await page.goBack();
    await expect(page.getByRole('heading', { level: 1, name: 'Learn' })).toBeVisible();
    await page.goBack();
    await expect(page).toHaveURL(/\/type$/);
    await expect(page.getByTestId('prompt-arena')).toBeVisible();

    // No document load happened on the way.
    expect(await page.evaluate(() => Reflect.get(window, 'navigationMarker'))).toBe('kept');

    // The trainer works after coming back: focus is on the input and a key starts the test.
    await expect(page.locator('input[aria-label="Kana input sink"]')).toBeFocused();
    await page.keyboard.press('KeyA');
    await expect(page.getByTestId('prompt-arena')).toHaveAttribute('data-phase', 'running');
  });

  test('typing on another screen does not start a test', async ({ page }) => {
    await page.goto('/');
    await page.keyboard.press('KeyA');
    await page.getByRole('link', { name: 'type', exact: true }).click();
    await expect(page.getByTestId('prompt-arena')).toHaveAttribute('data-phase', 'idle');
  });

  test('settings: Reset progress asks for confirmation and can be cancelled', async ({ page }) => {
    await page.goto('/settings');
    await page.getByRole('button', { name: 'Reset Progress' }).click();

    const dialog = page.locator('dialog[open]');
    await expect(dialog).toBeVisible();
    await expect(dialog).toContainText('Are you sure');
    await dialog.getByRole('button', { name: 'Cancel' }).click();
    await expect(page.locator('dialog[open]')).toHaveCount(0);

    await page.getByRole('button', { name: 'Reset Progress' }).click();
    await page.locator('dialog[open]').getByRole('button', { name: 'Reset Everything' }).click();
    await expect(page.locator('dialog[open]')).toHaveCount(0);
  });

  test('the language switch is in the navigation on every screen', async ({ page }) => {
    await page.goto('/about');
    await page.getByRole('radio', { name: 'RU' }).click();
    await expect(page.getByRole('heading', { level: 1, name: 'О проекте' })).toBeVisible();
    await expect(page).toHaveTitle('О проекте — Nekotype');
    await page.getByRole('radio', { name: 'en', exact: true }).click();
    await expect(page.getByRole('heading', { level: 1, name: 'About' })).toBeVisible();
  });
});

test.describe('settings: show the translation', () => {
  test('turning it off keeps the stream in place and survives a reload', async ({ page }) => {
    await seedSettings(page, {
      typing: {
        script: 'hiragana',
        content: 'words',
        weakFocus: false,
        test: { kind: 'time', seconds: 120 },
      },
    });
    await openTypingScreen(page);
    const translation = page.getByTestId('translation');
    await expect(translation).not.toHaveText('');
    const arena = page.getByTestId('prompt-arena');
    const before = await arena.boundingBox();

    await page.getByRole('link', { name: 'settings' }).click();
    const toggle = page.getByRole('switch', { name: 'Show the translation under the text' });
    await expect(toggle).toHaveAttribute('aria-checked', 'true');
    await toggle.click();
    await expect(toggle).toHaveAttribute('aria-checked', 'false');
    await expectStoredTyping(page, 'showTranslation', false);

    await openTypingScreen(page);
    await expect(page.getByTestId('prompt-text')).not.toHaveText('');
    await expect(translation).toHaveText('');
    const after = await arena.boundingBox();
    expect(Math.abs((after?.y ?? 0) - (before?.y ?? 0))).toBeLessThan(1);
    expect(Math.abs((after?.height ?? 0) - (before?.height ?? 0))).toBeLessThan(1);
  });
});
