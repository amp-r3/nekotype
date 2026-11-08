import { test, expect } from '@playwright/test';
import { openTypingScreen } from './lib/app';
import { canonicalOfPrompt } from './lib/prompt';

const INPUT = 'input[aria-label="Kana input sink"]';

// What only a real browser shows about the test screen: whether the mouse reveals Restart, and
// whether the field keeps the focus (a phone keeps its keyboard open only then). The rules behind
// them are unit tests (test-screen-focus.test.tsx).
test.describe('test screen: Restart and the focus', () => {
  test('Restart is hidden until the mouse is over it', async ({ page }) => {
    await openTypingScreen(page);
    const restart = page.getByRole('button', { name: 'Restart test' });
    await expect(restart).toHaveCSS('opacity', '0');
    await restart.hover();
    await expect(restart).toHaveCSS('opacity', '1');
    await page.mouse.move(5, 5);
    await expect(restart).toHaveCSS('opacity', '0');
  });

  test(
    'a click on Restart, on Finish and on Next test leaves the focus on the field',
    { tag: '@mobile' },
    async ({ page }) => {
      await openTypingScreen(page);
      await page.getByRole('radio', { name: 'Zen' }).click();
      const input = page.locator(INPUT);

      await page.keyboard.press('KeyA');
      await page.getByRole('button', { name: 'Restart test' }).click();
      await expect(page.getByTestId('prompt-arena')).toHaveAttribute('data-phase', 'idle');
      await expect(input).toBeFocused();

      const canonical = await canonicalOfPrompt(page);
      await page.keyboard.type(canonical, { delay: 15 });
      await expect(page.getByTestId('live-counter')).toHaveText(/^[0-1]$/);
      await page.getByRole('button', { name: /^Finish/ }).click();
      await expect(page.getByTestId('results-panel')).toBeVisible();

      await page.getByRole('button', { name: 'Next Test' }).click();
      await expect(page.getByTestId('prompt-arena')).toHaveAttribute('data-phase', 'idle');
      await expect(input).toBeFocused();
    },
  );
});
