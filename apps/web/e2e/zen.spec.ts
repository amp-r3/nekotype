import { test, expect } from '@playwright/test';
import { openTypingScreen } from './lib/app';
import type { Page } from '@playwright/test';
import { canonicalOfPrompt } from './lib/prompt';

const FINISH = { name: /^finish/ };

async function chooseZen(page: Page): Promise<void> {
  await openTypingScreen(page);
  const zen = page.getByRole('radio', { name: 'Zen' });
  await zen.click();
  await expect(zen).toHaveAttribute('aria-checked', 'true');
}

// Types the prompts one after another, from the canonical romaji of each prompt on display.
async function typePrompts(page: Page, count: number): Promise<void> {
  for (let i = 0; i < count; i++) {
    const canonical = await canonicalOfPrompt(page);
    const glyph = await page.getByTestId('prompt-text').innerText();
    await page.keyboard.type(canonical, { delay: 15 });
    if (i < count - 1) {
      await expect(page.getByTestId('prompt-text')).not.toHaveText(glyph, { timeout: 2000 });
    }
  }
}

test.describe('zen: a test without a length, ended by hand', () => {
  test('has no length control and is remembered across a reload', async ({ page }) => {
    await chooseZen(page);
    await expect(page.getByRole('radiogroup', { name: 'length' })).toHaveCount(0);
    await expect(page.getByRole('radiogroup', { name: 'length' })).toHaveCount(0);

    // The settings are saved after a short delay.
    await page.waitForTimeout(450);
    await page.reload();
    await expect(page.getByRole('radio', { name: 'Zen' })).toHaveAttribute('aria-checked', 'true');
    await expect(page.getByRole('button', FINISH)).toBeVisible();

    // Back to time: the length returns.
    await page.getByRole('radio', { name: 'Time' }).click();
    await expect(page.getByRole('radiogroup', { name: 'length' })).toBeVisible();
    await expect(page.getByRole('button', FINISH)).toHaveCount(0);
  });

  test('counts the prompts, enables Finish when it starts, and shows the result', async ({
    page,
  }) => {
    await chooseZen(page);
    const finish = page.getByRole('button', FINISH);
    await expect(finish).toBeDisabled();
    await expect(page.getByTestId('live-counter')).toHaveText('0');

    await typePrompts(page, 4);
    await expect(finish).toBeEnabled();
    // The last prompt may wait for the next key (a final ん is settled by it).
    await expect(page.getByTestId('live-counter')).toHaveText(/^[3-4]$/);
    // Zen does not end by itself.
    await page.waitForTimeout(1500);
    await expect(page.getByTestId('prompt-arena')).toHaveAttribute('data-phase', 'running');

    await finish.click();
    await expect(page.getByTestId('results-panel')).toBeVisible();
    // The results take the focus themselves; wait for it so a slow runner cannot press too early.
    await expect(page.getByTestId('results-panel')).toBeFocused();
    await page.keyboard.press('Enter');
    // Next test: the same zen config, idle.
    await expect(page.getByTestId('prompt-arena')).toHaveAttribute('data-phase', 'idle');
    await expect(page.getByRole('radio', { name: 'Zen' })).toHaveAttribute('aria-checked', 'true');
  });

  // Cmd+Enter, and Ctrl+Enter in a test that is not zen, are decided without a browser
  // (input-adapter.test.ts, input-source.test.ts, session.test.ts); this one proves the real key path.
  test('Ctrl+Enter ends the test', async ({ page }) => {
    await chooseZen(page);
    await typePrompts(page, 3);
    await page.keyboard.press('Control+Enter');
    await expect(page.getByTestId('results-panel')).toBeVisible();
  });

  test('with no prompt completed it starts a new test and shows no result', async ({ page }) => {
    await chooseZen(page);
    await page.keyboard.press('KeyZ'); // a key, so the test has started, but no kana is typed
    await expect(page.getByTestId('prompt-arena')).toHaveAttribute('data-phase', 'running');

    await page.keyboard.press('Control+Enter');
    await expect(page.getByTestId('prompt-arena')).toHaveAttribute('data-phase', 'idle');
    await expect(page.getByTestId('results-panel')).toHaveCount(0);
    // The interface is back and typing works at once.
    await expect(page.getByRole('navigation')).toBeVisible();
    await page.keyboard.press('KeyZ');
    await expect(page.getByTestId('prompt-arena')).toHaveAttribute('data-phase', 'running');
  });

  test('keeps a test whose only prompt ends in ん, typed with a single n', async ({ page }) => {
    // One word in the vocabulary ends in ん, so a random Restart finds it only now and then. The
    // random source is replaced by a number the test sets, and Restart sweeps it across [0, 1):
    // the word is picked whenever the number falls in its slice of the pool, and that slice is far
    // wider than a step of the sweep. The sweep is the same on every run.
    await page.addInitScript(() => {
      Reflect.set(window, '__random', 0.5);
      Math.random = () => Number(Reflect.get(window, '__random'));
    });
    await chooseZen(page);
    await page.getByRole('radio', { name: 'Words' }).click();
    // Until the vocabulary has loaded the screen shows no prompt, and the chunk, once it arrives,
    // restarts the test. Wait for a translation before looking for the word.
    await expect(page.getByTestId('translation')).not.toHaveText('');
    const promptText = page.getByTestId('prompt-text');
    const steps = 400;
    for (let i = 0; i < steps && !(await promptText.innerText()).endsWith('ん'); i++) {
      await page.evaluate((r) => Reflect.set(window, '__random', r), (i + 0.5) / steps);
      await page.getByRole('button', { name: 'Restart test' }).click();
    }
    await expect(promptText).toHaveText(/ん$/);
    // Restart keeps the focus on its button, where Enter would press it: type from the input.
    await page.getByRole('textbox', { name: 'Kana input sink' }).focus();
    const canonical = await canonicalOfPrompt(page);
    expect(canonical.endsWith('nn')).toBe(true);

    await page.keyboard.type(canonical.slice(0, -1), { delay: 20 });
    await expect(page.getByTestId('live-counter')).toHaveText('1');
    await page.keyboard.press('Control+Enter');
    await expect(page.getByTestId('results-panel')).toBeVisible();
  });

  test('the results hold the focus without drawing a ring around the screen', async ({ page }) => {
    await chooseZen(page);
    await page.keyboard.type(await canonicalOfPrompt(page), { delay: 15 });
    // Ended from the keyboard, so the focus is a keyboard focus (`:focus-visible`).
    await page.keyboard.press('Control+Enter');
    const panel = page.getByTestId('results-panel');
    await expect(panel).toBeFocused();
    await expect(panel).toHaveCSS('outline-style', 'none');
  });

  test('on the results the first Tab reaches Next test, and Enter starts it', async ({ page }) => {
    await chooseZen(page);
    await page.keyboard.type(await canonicalOfPrompt(page), { delay: 15 });
    await page.getByRole('button', FINISH).click();
    await expect(page.getByTestId('results-panel')).toBeFocused();
    await page.keyboard.press('Tab');
    await expect(page.getByRole('button', { name: 'next test' })).toBeFocused();
    await page.keyboard.press('Enter');
    await expect(page.getByTestId('prompt-arena')).toHaveAttribute('data-phase', 'idle');
  });

  test('the first Tab still reaches Restart, with Finish after it', async ({ page }) => {
    await chooseZen(page);
    await page.keyboard.press('KeyZ');
    // Finish is enabled once the test runs; a Tab before that would skip it.
    await expect(page.getByRole('button', FINISH)).toBeEnabled();
    await page.keyboard.press('Tab');
    await expect(page.getByRole('button', { name: 'Restart test' })).toBeFocused();
    await page.keyboard.press('Tab');
    await expect(page.getByRole('button', FINISH)).toBeFocused();
  });

  test('keeps the stream going over many prompts', async ({ page }) => {
    await chooseZen(page);
    // The window is trimmed in steps, once more than 60 tokens lie behind the caret.
    await typePrompts(page, 70);
    // A window around the caret, not the whole test, and the first token numbers keep rising.
    const first = Number(await page.locator('[data-token]').first().getAttribute('data-token'));
    expect(first).toBeGreaterThan(0);
    expect(await page.locator('[data-token]').count()).toBeLessThan(200);
  });
});
