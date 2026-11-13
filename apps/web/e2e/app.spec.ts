import { test, expect } from '@playwright/test';
import { expectStoredTyping, openConfigBar, openTypingScreen } from './lib/app';
import { canonicalOfPrompt } from './lib/prompt';

test.describe('focus redirection and keyboard-first typing', () => {
  test(
    '(a) load, type immediately without clicking, the test starts',
    { tag: '@mobile' },
    async ({ page }) => {
      await openTypingScreen(page);

      const input = page.locator('input[aria-label="Kana input sink"]');
      await expect(input).toBeFocused();

      // Type a key immediately without clicking anywhere
      await page.keyboard.press('KeyA');

      // The test must have started (live stats strip shows the kpm counter)
      await expect(page.getByTestId('prompt-arena')).toHaveAttribute('data-phase', 'running');
    },
  );

  test(
    '(b) click a ConfigBar button, press a letter: focus is on the input AND the letter was processed (also with a wrong letter: mistake counted)',
    { tag: '@mobile' },
    async ({ page }) => {
      await openTypingScreen(page);
      await openConfigBar(page);
      const input = page.locator('input[aria-label="Kana input sink"]');

      // Click a ConfigBar button (e.g. Katakana) to steal focus from input
      const katakanaBtn = page.getByRole('radio', { name: 'Katakana' });
      await katakanaBtn.click();
      await expect(katakanaBtn).toBeFocused();

      // Press a wrong letter key: 'q' starts no kana, while 'z' starts ジ (zi), which a word may open with
      await page.keyboard.press('KeyQ');

      // Focus must immediately move back to input
      await expect(input).toBeFocused();

      // Test starts and records mistake (arena is marked rejected)
      await expect(page.getByTestId('prompt-arena')).toHaveAttribute('data-phase', 'running');
      await expect(page.getByTestId('prompt-arena')).toHaveAttribute('data-rejected', 'true');
    },
  );

  test('(d) set phrases mode, reload: the first prompt is a word/phrase, never a single kana', async ({
    page,
  }) => {
    await openTypingScreen(page);

    const input = page.locator('input[aria-label="Kana input sink"]');
    await expect(input).toBeFocused();

    // Switch to Phrases (Words is the default, so only a change is written)
    const phrasesBtn = page.getByRole('radio', { name: 'Phrases' });
    await phrasesBtn.click();
    await expect(phrasesBtn).toHaveAttribute('aria-checked', 'true');

    // The setting is written on the click; wait until it is stored before reloading.
    await expectStoredTyping(page, 'content', 'phrases');

    // Reload the page
    await page.reload();
    await expect(input).toBeFocused();
    await expect(page.getByRole('radio', { name: 'Phrases' })).toHaveAttribute(
      'aria-checked',
      'true',
    );

    // First prompt must be a word/phrase (length >= 2 characters, never a single kana)
    const promptElement = page.getByTestId('prompt-text');
    await expect(async () => {
      const text = await promptElement.innerText();
      expect(text.length).toBeGreaterThanOrEqual(2);
    }).toPass({ timeout: 5000 });
  });

  test('(e) tab → enter restarts the test', async ({ page }) => {
    await openTypingScreen(page);
    const input = page.locator('input[aria-label="Kana input sink"]');
    await expect(input).toBeFocused();

    // Start typing to enter running phase
    await page.keyboard.press('KeyA');
    await expect(page.getByTestId('prompt-arena')).toHaveAttribute('data-phase', 'running');

    // Tab moves focus naturally to the restart button
    await page.keyboard.press('Tab');
    const restartBtn = page.getByRole('button', { name: 'Restart test' });
    await expect(restartBtn).toBeFocused();

    // Enter on the focused restart button resets the test back to idle
    await page.keyboard.press('Enter');
    await expect(page.getByTestId('prompt-arena')).toHaveAttribute('data-phase', 'idle');

    // Typing again immediately starts a fresh test
    await page.keyboard.press('KeyA');
    await expect(page.getByTestId('prompt-arena')).toHaveAttribute('data-phase', 'running');
  });

  test(
    '(f) a full count test (10 prompts, type canonical answers) ends on results screen, "Next test" via Enter starts a new idle test',
    { tag: '@mobile' },
    async ({ page }) => {
      await openTypingScreen(page);
      const input = page.locator('input[aria-label="Kana input sink"]');
      await expect(input).toBeFocused();
      await openConfigBar(page);

      // Configure Count test with 10 prompts
      const countRadio = page.getByRole('radio', { name: 'Count' });
      await countRadio.click();
      await expect(countRadio).toHaveAttribute('aria-checked', 'true');

      const tenPromptsRadio = page.getByRole('radio', { name: '10', exact: true });
      await tenPromptsRadio.click();
      await expect(tenPromptsRadio).toHaveAttribute('aria-checked', 'true');

      // Type canonical answers for all 10 prompts
      for (let i = 0; i < 10; i++) {
        await expect(page.getByTestId('prompt-arena')).toBeVisible();
        const canonical = await canonicalOfPrompt(page);
        const glyph = await page.getByTestId('prompt-text').innerText();

        if (i < 9) {
          if (canonical) {
            await page.keyboard.type(canonical, { delay: 15 });
          }
          // Wait for prompt to change to next one
          await expect(page.getByTestId('prompt-text')).not.toHaveText(glyph, { timeout: 2000 });
        } else {
          if (canonical) {
            await page.keyboard.type(canonical, { delay: 15 });
          }
        }
      }

      // After 10 prompts, the test completes automatically and renders ResultsPanel
      const nextTestBtn = page.getByRole('button', { name: 'next test' });
      await expect(nextTestBtn).toBeVisible({ timeout: 5000 });
      // The screen holds the focus, so Enter and `tab → enter` both start the next test.
      await expect(page.getByTestId('results-panel')).toBeFocused();

      // D14: every block of the results rises in (`animate-reveal`, one `dur-stagger` apart)
      await expect(page.getByTestId('mode-line').locator('..')).toHaveCSS(
        'animation-name',
        'reveal',
      );

      // Press Enter to activate "next test" button
      await page.keyboard.press('Enter');

      // Results screen closes, returns to idle test stage with input focused
      await expect(nextTestBtn).toHaveCount(0);
      await expect(input).toBeFocused();
      await expect(page.getByTestId('prompt-arena')).toHaveAttribute('data-phase', 'idle');
    },
  );

  test('(i) a count test over words (ん at the end of prompts, next prompt shown early) ends on the results screen', async ({
    page,
  }) => {
    await openTypingScreen(page);
    const input = page.locator('input[aria-label="Kana input sink"]');
    await expect(input).toBeFocused();

    await page.getByRole('radio', { name: 'Count' }).click();
    await page.getByRole('radio', { name: '10', exact: true }).click();
    const words = page.getByRole('radio', { name: 'Words' });
    // The words load lazily (or were prefetched while the browser was idle) and the trainer
    // restarts the test when they are in: wait for a word on screen, or the restart lands in the
    // middle of typing and the count starts over.
    await words.click();
    await expect(words).toHaveAttribute('aria-checked', 'true');
    await expect(page.getByText('loading vocabulary…')).toHaveCount(0);
    await expect(page.getByTestId('prompt-text')).toHaveText(/^.+$/);

    for (let i = 0; i < 10; i++) {
      await expect(page.getByTestId('prompt-arena')).toBeVisible();
      // Waits until the lazily loaded words are on screen, then answers for the prompt shown
      const canonical = await canonicalOfPrompt(page);
      const glyph = await page.getByTestId('prompt-text').innerText();
      if (canonical) {
        await page.keyboard.type(canonical, { delay: 15 });
      }
      if (i < 9) {
        await expect(page.getByTestId('prompt-text')).not.toHaveText(glyph, { timeout: 2000 });
      }
    }

    await expect(page.getByRole('button', { name: 'next test' })).toBeVisible({ timeout: 5000 });
    // No mistakes: every answer was canonical
    await expect(page.getByTestId('results-panel')).toBeVisible();
  });

  test('(g) RU/EN switch changes a visible label and survives a reload', async ({ page }) => {
    await openTypingScreen(page);

    // Check initial English label of the script switch
    const scriptRadio = page.getByRole('radio', { name: 'Hiragana' });
    await expect(scriptRadio).toBeVisible();

    // Switch to Russian locale
    const ruButton = page.getByRole('button', { name: 'ru', exact: true });
    await ruButton.click();
    await expect(ruButton).toHaveAttribute('aria-pressed', 'true');

    // Script switch label updates to Russian
    const ruScriptRadio = page.getByRole('radio', { name: 'Хирагана' });
    await expect(ruScriptRadio).toBeVisible();
    await expect(page.locator('html')).toHaveAttribute('lang', 'ru');

    // Reload page
    await page.reload();

    // Label and lang attribute persist across reload
    await expect(page.getByRole('radio', { name: 'Хирагана' })).toBeVisible();
    await expect(page.locator('html')).toHaveAttribute('lang', 'ru');

    // Clean up: switch back to English
    const enButton = page.getByRole('button', { name: 'en', exact: true });
    await enButton.click();
    await expect(page.getByRole('radio', { name: 'Hiragana' })).toBeVisible();
  });

  test('(h) Space in the input does nothing; Esc reveals the answer and the prompt is assisted', async ({
    page,
  }) => {
    await openTypingScreen(page);
    const input = page.locator('input[aria-label="Kana input sink"]');
    await expect(input).toBeFocused();

    // Check that revealed answer is not present initially
    await expect(page.locator('text=Revealed:')).toHaveCount(0);

    // Press Space inside the input sink
    await page.keyboard.press('Space');

    // Space is ignored: does not start test, does not reveal, does not count mistake
    await expect(page.getByTestId('prompt-arena')).toHaveAttribute('data-phase', 'idle');
    await expect(page.locator('text=Revealed:')).toHaveCount(0);

    // Press Escape inside the input sink
    await page.keyboard.press('Escape');

    // Escape triggers reveal: canonical romaji is shown
    await expect(page.locator('text=Revealed:')).toBeVisible();

    // Type canonical answer to complete the assisted prompt
    const canonical = await canonicalOfPrompt(page);
    const firstGlyph = await page.getByTestId('prompt-text').innerText();
    if (canonical) {
      await page.keyboard.type(canonical, { delay: 15 });
    }

    // Prompt advances, test starts and reflects accuracy < 100% due to the reveal mistake
    await expect(page.getByTestId('prompt-text')).not.toHaveText(firstGlyph, { timeout: 2000 });
    await expect(page.getByTestId('prompt-arena')).toHaveAttribute('data-phase', 'running');
    await expect(page.locator('text=100%')).toHaveCount(0);
  });
});
