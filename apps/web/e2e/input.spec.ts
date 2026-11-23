import { test, expect } from '@playwright/test';
import type { CDPSession, Locator, Page } from '@playwright/test';
import { FIELD, openRecall } from './lib/learn';

const LAYOUT_NOTICE = 'Switch your keyboard layout to English';
const IME_NOTICE = 'Turn off the Japanese IME';

// Playwright cannot press a key that is not on its keyboard layout ("Unknown key"), so the key of a
// Cyrillic layout is sent as the event a browser would fire.
async function pressCyrillic(target: Locator, key: string): Promise<void> {
  await target.dispatchEvent('keydown', { key, bubbles: true, cancelable: true });
}

// The task is still waiting for its answer: nothing was typed into the buffer, the kana is not
// marked and the session has not moved on.
async function expectNoAnswer(page: Page): Promise<void> {
  await expect(page.locator('[data-task-buffer]')).toHaveText('');
  await expect(page.locator('[data-task-kana]')).not.toHaveClass(/is-miss|is-correct/);
  await expect(page.getByTestId('task-session')).toHaveText('learning · 1 of 30');
}

test.describe('input: layouts', { tag: '@mobile' }, () => {
  test('a Cyrillic key asks to switch the layout and is not taken as an answer', async ({
    page,
  }) => {
    await openRecall(page);

    await pressCyrillic(page.locator(FIELD), 'ф');
    await expect(page.getByText(LAYOUT_NOTICE)).toBeVisible();
    await expectNoAnswer(page);

    // The notice goes away at the next Latin key ("q" starts no kana, so the task goes on).
    await page.keyboard.press('KeyQ');
    await expect(page.getByText(LAYOUT_NOTICE)).toHaveCount(0);
  });

  test('text inserted without a key press is handled the same way (beforeinput)', async ({
    page,
  }) => {
    await openRecall(page);
    await page.keyboard.insertText('ы');
    await expect(page.getByText(LAYOUT_NOTICE)).toBeVisible();
    await expectNoAnswer(page);
  });

  test('a Cyrillic key pressed on a button is not typed either, and the field gets the focus', async ({
    page,
  }) => {
    await openRecall(page);
    const leave = page.getByRole('button', { name: 'leave session' });
    await leave.focus();
    await expect(leave).toBeFocused();
    await pressCyrillic(leave, 'ф');
    await expect(page.locator(FIELD)).toBeFocused();
    await expect(page.getByText(LAYOUT_NOTICE)).toBeVisible();
    await expectNoAnswer(page);
  });
});

test.describe('input: keys that belong to the browser', () => {
  test('Ctrl+Enter on a button is not cancelled and keeps the focus', async ({ page }) => {
    await openRecall(page);
    const leave = page.getByRole('button', { name: 'leave session' });
    await leave.focus();
    const prevented = await leave.evaluate((el) => {
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
    await expect(leave).toBeFocused();
  });
});

async function compose(client: CDPSession, text: string): Promise<void> {
  await client.send('Input.imeSetComposition', {
    text,
    selectionStart: text.length,
    selectionEnd: text.length,
  });
}

// Types one answer the way Gboard does: the letters are composed one after another (a beforeinput
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
    // し is "shi": three letters composed one after another, then committed.
    await openRecall(page, 'し');
    const client = await page.context().newCDPSession(page);

    await composeWord(client, 'shi');
    await expect(page.getByText(IME_NOTICE)).toHaveCount(0);

    // Typed once, the answer is right and the session goes on to the next task; typed twice, the
    // commit would be a wrong key on top of it.
    await expect(page.getByTestId('task-session')).toHaveText('learning · 2 of 30');
  });

  test('a Japanese IME that is on shows the notice once kana are composed', async ({ page }) => {
    await openRecall(page);
    const client = await page.context().newCDPSession(page);

    await compose(client, 'k');
    await expect(page.getByText(IME_NOTICE)).toHaveCount(0);

    await compose(client, 'か');
    await expect(page.getByText(IME_NOTICE)).toBeVisible();
    await client.send('Input.insertText', { text: 'か' });

    // Turned off, the next real key hides it.
    await page.keyboard.press('KeyQ');
    await expect(page.getByText(IME_NOTICE)).toHaveCount(0);
  });

  test('a Japanese IME that is on is not taken as an answer with its first letter', async ({
    page,
  }) => {
    await openRecall(page);
    const client = await page.context().newCDPSession(page);

    await compose(client, 'k');
    await compose(client, 'か');
    await client.send('Input.insertText', { text: 'か' });
    await expect(page.getByText(IME_NOTICE)).toBeVisible();
    await expectNoAnswer(page);
  });

  test('a Latin composition after kana hides the notice', async ({ page }) => {
    await openRecall(page);
    const client = await page.context().newCDPSession(page);

    await compose(client, 'か');
    await client.send('Input.insertText', { text: 'か' });
    await expect(page.getByText(IME_NOTICE)).toBeVisible();

    // The layout was switched: a Latin vowel in a composition proves the IME is off.
    await compose(client, 'a');
    await expect(page.getByText(IME_NOTICE)).toHaveCount(0);
  });

  test('the converted kana are not typed, and nothing is doubled', async ({ page }) => {
    await openRecall(page);
    const client = await page.context().newCDPSession(page);

    await compose(client, 'か');
    await client.send('Input.insertText', { text: 'か' });

    await expectNoAnswer(page);
    await expect(page.getByText(LAYOUT_NOTICE)).toHaveCount(0);
  });
});
