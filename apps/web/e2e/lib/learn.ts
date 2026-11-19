import { expect } from '@playwright/test';
import type { Page } from '@playwright/test';
import { allKanaRows } from '@nekotype/engine';

// The romaji the page asks for or accepts, worked out from what the page shows (ADR 045): the kana
// on screen, through the kana table.
const romajiOf = new Map<string, string>();
for (const row of allKanaRows) {
  for (const entry of row.entries) {
    const romaji = entry.ime[0];
    if (romaji === undefined) continue;
    if (entry.hiragana !== undefined) romajiOf.set(entry.hiragana, romaji);
    romajiOf.set(entry.katakana, romaji);
  }
}

async function text(page: Page, selector: string): Promise<string> {
  return (await page.locator(selector).first().textContent()) ?? '';
}

// A touch screen types through the on-screen keyboard: beforeinput/input events without keydown.
async function typeRomaji(page: Page, romaji: string, screenKeyboard: boolean): Promise<void> {
  if (!screenKeyboard) {
    await page.keyboard.type(romaji);
    return;
  }
  for (const char of romaji) await page.keyboard.insertText(char);
}

// Plays one task of whatever kind is on screen, correctly.
export async function answer(page: Page, tapOptions: boolean): Promise<void> {
  const task = page.getByTestId('kana-task');
  const kind = await task.getAttribute('data-kind');
  if (kind === 'introduction') {
    const hint = await page.locator('.nk-task__ghost').getAttribute('aria-label');
    await typeRomaji(page, hint ?? '', tapOptions);
  } else if (kind === 'recall') {
    const romaji = romajiOf.get(await text(page, '[data-task-kana]'));
    expect(romaji).toBeDefined();
    await typeRomaji(page, romaji ?? '', tapOptions);
  } else {
    const wanted = await text(page, '[data-testid="task-prompt"]');
    const options = page.locator('.nk-opt');
    const labels = await options.locator('.nk-opt__label').allTextContents();
    const index = labels.findIndex((label) => romajiOf.get(label) === wanted);
    expect(index).toBeGreaterThanOrEqual(0);
    if (tapOptions) {
      await options.nth(index).tap();
      // A tap keeps the focus in the field: the on-screen keyboard stays open.
      await expect(page.getByLabel('Kana answer input')).toBeFocused();
    } else await page.keyboard.press(`Digit${String(index + 1)}`);
  }
}
