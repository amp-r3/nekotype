import { test, expect } from '@playwright/test';
import type { Page } from '@playwright/test';
import { seedSettings } from './lib/app';
import { canonicalOfPrompt } from './lib/prompt';

// Types a whole count test, one prompt after another, `delay` ms per key.
async function typeCountTest(page: Page, prompts: number, delay: number): Promise<void> {
  for (let i = 0; i < prompts; i++) {
    const canonical = await canonicalOfPrompt(page);
    const glyph = await page.getByTestId('prompt-text').innerText();
    await page.keyboard.type(canonical, { delay });
    if (i < prompts - 1) {
      await expect(page.getByTestId('prompt-text')).not.toHaveText(glyph, { timeout: 2000 });
    }
  }
}

test.describe('the results screen (metrics.md, Screens)', () => {
  test('a first test is a personal best, a slower second one shows the average and the best', async ({
    page,
  }) => {
    await seedSettings(page, {
      typing: { script: 'hiragana', test: { kind: 'count', prompts: 10 } },
    });
    await expect(page.getByTestId('prompt-arena')).toBeVisible();

    await typeCountTest(page, 10, 10);
    const panel = page.getByTestId('results-panel');
    await expect(panel).toBeVisible();
    await expect(panel.getByText('personal best', { exact: true })).toBeVisible();
    await expect(panel.getByRole('img', { name: 'the cat is pleased' })).toBeVisible();
    await expect(panel.getByTestId('mode-line')).toHaveText('words · hiragana · relaxed · 10');
    await expect(panel.getByText(/ vs /)).toHaveCount(0);

    await panel.getByRole('button', { name: /next test/ }).click();
    await expect(page.getByTestId('prompt-arena')).toBeVisible();

    await typeCountTest(page, 10, 120);
    await expect(panel).toBeVisible();
    await expect(panel.getByText('personal best', { exact: true })).toHaveCount(0);
    await expect(panel.getByText(/vs average/)).toContainText('−');
    await expect(panel.getByText(/vs personal best/)).toContainText('−');
  });
});
