import { test, expect } from '@playwright/test';
import { openTypingScreen } from './lib/app';
import type { CDPSession, Locator, Page } from '@playwright/test';
import { canonicalOfPrompt } from './lib/prompt';

const LAYOUT_NOTICE = 'Switch your keyboard layout to English';
const IME_NOTICE = 'Turn off the Japanese IME';
const FIELD = 'input[aria-label="Kana input sink"]';

// Playwright cannot press a key that is not on its keyboard layout ("Unknown key"), so the key of a
// Cyrillic layout is sent as the event a browser would fire.
async function pressCyrillic(target: Locator, key: string): Promise<void> {
  await target.dispatchEvent('keydown', { key, bubbles: true, cancelable: true });
}

test.describe('input: layouts', { tag: '@mobile' }, () => {
  test('a Cyrillic key asks to switch the layout, starts nothing and counts no mistake', async ({
    page,
  }) => {
    await openTypingScreen(page);
    await expect(page.locator(FIELD)).toBeFocused();

    await pressCyrillic(page.locator(FIELD), 'ф');
    await expect(page.getByText(LAYOUT_NOTICE)).toBeVisible();
    // The test did not start and the prompt was not marked as rejected.
    await expect(page.getByTestId('prompt-arena')).toHaveAttribute('data-phase', 'idle');
    expect(await page.getByTestId('prompt-arena').getAttribute('data-rejected')).toBeNull();

    // The notice goes away at the next Latin key, which starts the test.
    await page.keyboard.press('KeyA');
    await expect(page.getByText(LAYOUT_NOTICE)).toHaveCount(0);
    await expect(page.getByTestId('prompt-arena')).toHaveAttribute('data-phase', 'running');
  });

  test('text inserted without a key press is handled the same way (beforeinput)', async ({
    page,
  }) => {
    await openTypingScreen(page);
    await page.keyboard.insertText('ы');
    await expect(page.getByText(LAYOUT_NOTICE)).toBeVisible();
    await expect(page.getByTestId('prompt-arena')).toHaveAttribute('data-phase', 'idle');
  });

  test('a Cyrillic key pressed on a button is not typed either, and the field gets the focus', async ({
    page,
  }) => {
    await openTypingScreen(page);
    await page.getByRole('radio', { name: 'Katakana' }).click();
    await pressCyrillic(page.getByRole('radio', { name: 'Katakana' }), 'ф');
    await expect(page.locator(FIELD)).toBeFocused();
    await expect(page.getByText(LAYOUT_NOTICE)).toBeVisible();
  });
});

test.describe('input: keys that belong to the browser', () => {
  test('Ctrl+Enter on a link is not cancelled and keeps the focus', async ({ page }) => {
    await openTypingScreen(page);
    const link = page.getByRole('navigation').getByRole('link').first();
    await link.focus();
    const prevented = await link.evaluate((el) => {
      const event = new KeyboardEvent('keydown', {
        key: 'Enter',
        ctrlKey: true,
        bubbles: true,
        cancelable: true,
      });
      el.dispatchEvent(event);
      return event.defaultPrevented;
    });
    expect(prevented).toBe(false);
    await expect(link).toBeFocused();
  });
});

async function compose(client: CDPSession, text: string): Promise<void> {
  await client.send('Input.imeSetComposition', {
    text,
    selectionStart: text.length,
    selectionEnd: text.length,
  });
}

// Types one prompt the way Gboard does: the letters are composed one after another (a beforeinput
// that cannot be cancelled, then input) and the word is committed.
async function composeWord(client: CDPSession, word: string): Promise<void> {
  for (let length = 1; length <= word.length; length++) {
    await compose(client, word.slice(0, length));
  }
  await client.send('Input.insertText', { text: word });
}

test.describe('input: composition (IME emulated through the DevTools protocol)', () => {
  test.skip(
    ({ browserName }) => browserName !== 'chromium',
    'Input.imeSetComposition is Chromium only',
  );

  test('Latin composition (Gboard) is typed once and shows no IME notice', async ({ page }) => {
    await openTypingScreen(page);
    await page.getByRole('radio', { name: 'Count' }).click();
    await page.getByRole('radio', { name: '10', exact: true }).click();
    // Tapping the text focuses the field, which is where a mobile keyboard types.
    await page.getByTestId('prompt-arena').click();
    await expect(page.locator(FIELD)).toBeFocused();
    const client = await page.context().newCDPSession(page);

    for (let i = 0; i < 10; i++) {
      const canonical = await canonicalOfPrompt(page);
      const glyph = await page.getByTestId('prompt-text').innerText();
      await composeWord(client, canonical);
      await expect(page.getByText(IME_NOTICE)).toHaveCount(0);
      if (i < 9) {
        // Typed twice, the commit would land on the next prompt as a wrong key.
        expect(await page.getByTestId('prompt-arena').getAttribute('data-rejected')).toBeNull();
        await expect(page.getByTestId('prompt-text')).not.toHaveText(glyph, { timeout: 2000 });
      }
    }

    await expect(page.getByTestId('results-panel')).toBeVisible();
    // Every kana was typed once, so the whole run is clean.
    await expect(page.getByText('Weakest Kana This Run')).toHaveCount(0);
    await expect(page.getByText('Best Streak').locator('xpath=following-sibling::span')).toHaveText(
      '10',
    );
  });

  test('a Japanese IME that is on shows the notice once kana are composed', async ({ page }) => {
    await openTypingScreen(page);
    const client = await page.context().newCDPSession(page);

    await compose(client, 'k');
    await expect(page.getByText(IME_NOTICE)).toHaveCount(0);

    await compose(client, 'か');
    await expect(page.getByText(IME_NOTICE)).toBeVisible();
    await client.send('Input.insertText', { text: 'か' });

    // Turned off, the next real key hides it.
    await page.keyboard.press('KeyA');
    await expect(page.getByText(IME_NOTICE)).toHaveCount(0);
  });

  test('a Japanese IME that is on does not start the test with its first letter', async ({
    page,
  }) => {
    await openTypingScreen(page);
    const client = await page.context().newCDPSession(page);

    await compose(client, 'k');
    await compose(client, 'か');
    await client.send('Input.insertText', { text: 'か' });
    await expect(page.getByText(IME_NOTICE)).toBeVisible();
    await expect(page.getByTestId('prompt-arena')).toHaveAttribute('data-phase', 'idle');
  });

  test('a Latin composition after kana hides the notice', async ({ page }) => {
    await openTypingScreen(page);
    const client = await page.context().newCDPSession(page);

    await compose(client, 'か');
    await client.send('Input.insertText', { text: 'か' });
    await expect(page.getByText(IME_NOTICE)).toBeVisible();

    // The layout was switched: a Latin vowel in a composition proves the IME is off.
    await compose(client, 'a');
    await expect(page.getByText(IME_NOTICE)).toHaveCount(0);
  });

  test('the converted kana are not typed, and nothing is doubled', async ({ page }) => {
    await openTypingScreen(page);
    const client = await page.context().newCDPSession(page);
    const before = await page.getByTestId('prompt-text').innerText();

    await compose(client, 'か');
    await client.send('Input.insertText', { text: 'か' });

    expect(await page.getByTestId('prompt-arena').getAttribute('data-rejected')).toBeNull();
    await expect(page.getByTestId('prompt-text')).toHaveText(before);
    await expect(page.getByText(LAYOUT_NOTICE)).toHaveCount(0);
  });
});
