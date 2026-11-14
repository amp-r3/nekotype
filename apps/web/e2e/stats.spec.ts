import { test, expect } from '@playwright/test';
import { seedSettings } from './lib/app';
import { canonicalOfPrompt } from './lib/prompt';

test.describe('the statistics page', () => {
  test('shows a finished test in the history', async ({ page }) => {
    await seedSettings(page, {
      typing: { script: 'hiragana', test: { kind: 'count', prompts: 10 } },
    });
    await expect(page.getByTestId('prompt-arena')).toBeVisible();

    for (let i = 0; i < 10; i++) {
      const canonical = await canonicalOfPrompt(page);
      const glyph = await page.getByTestId('prompt-text').innerText();
      await page.keyboard.type(canonical, { delay: 10 });
      if (i < 9) {
        await expect(page.getByTestId('prompt-text')).not.toHaveText(glyph, { timeout: 2000 });
      }
    }
    // The mode line is drawn once the result is saved.
    await expect(page.getByTestId('results-panel').getByTestId('mode-line')).toBeVisible();

    await page.getByRole('link', { name: 'stats', exact: true }).click();
    // No answers were given, so the typing section opens first.
    await expect(page.getByRole('radio', { name: 'typing', exact: true })).toBeChecked();

    const rows = page.getByTestId('history-row');
    await expect(rows).toHaveCount(1);
    await expect(rows.first()).toContainText('words · 10');
    await expect(rows.first()).toContainText('personal best');
    await expect(page.getByTestId('stats-bests')).toContainText('words · hiragana · relaxed · 10');
    await expect(page.getByTestId('stats-kpm-chart').getByTestId('chart-dot')).toHaveCount(1);
    await expect(page.getByTestId('stats-typing-tests')).toContainText('1 finished');

    // The learning section has no data; a hash names it directly.
    await page.goto('/stats#learning');
    await expect(page.getByRole('heading', { name: 'No answers yet' })).toBeVisible();
  });
});
