import { test, expect } from '@playwright/test';
import { openTypingScreen } from './lib/app';
import { canonicalOfPrompt } from './lib/prompt';
import type { Page } from '@playwright/test';

// Types two prompts, so the test has a completed prompt and time behind it.
async function typeTwoPrompts(page: Page): Promise<void> {
  for (let i = 0; i < 2; i++) {
    const canonical = await canonicalOfPrompt(page);
    const glyph = await page.getByTestId('prompt-text').innerText();
    await page.keyboard.type(canonical, { delay: 30 });
    if (i === 0) await expect(page.getByTestId('prompt-text')).not.toHaveText(glyph);
  }
}

test.describe('a test that ends by itself (metrics.md, Idle end and Hidden tab)', () => {
  test('5 seconds without input end the test with a notice', async ({ page }) => {
    await openTypingScreen(page);
    await typeTwoPrompts(page);
    await expect(page.getByTestId('results-panel')).toBeVisible({ timeout: 8000 });
    await expect(page.getByText('test ended: 5 seconds without input')).toBeVisible();
  });

  test('a hidden tab ends the test at once with a notice', async ({ page }) => {
    await openTypingScreen(page);
    await typeTwoPrompts(page);
    await page.evaluate(() => {
      Object.defineProperty(document, 'visibilityState', { value: 'hidden', configurable: true });
      document.dispatchEvent(new Event('visibilitychange'));
    });
    await expect(page.getByTestId('results-panel')).toBeVisible({ timeout: 2000 });
    await expect(page.getByText('test ended: the tab was hidden')).toBeVisible();
  });
});
