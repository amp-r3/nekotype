import { expect } from '@playwright/test';
import type { Page } from '@playwright/test';
import { allKanaRows } from '@nekotype/engine';
import { seedLog } from './app';
import { learnedLog } from './kana';

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

/** The hidden field of a learning session: every key of recall goes through it. */
export const FIELD = 'input[aria-label="Kana answer input"]';

/** A month: long enough for any learned kana to be due again. */
const MONTH_MS = 30 * 864e5;

/**
 * Starts a session whose first task is the recall of `kana`: it was learned a month ago, so it is
 * the one due kana, and the planner takes it first. Waits until the hidden field has the focus: a
 * key pressed before the task is on screen is ignored by design.
 */
export async function openRecall(page: Page, kana = 'あ'): Promise<void> {
  await seedLog(page, '/', learnedLog([kana], MONTH_MS));
  await page.getByRole('button', { name: 'continue' }).click();
  await expect(page.getByTestId('task-session')).toHaveText('learning · 1 of 30');
  await expect(page.getByTestId('kana-task')).toHaveAttribute('data-kind', 'recall');
  await expect(page.locator(FIELD)).toBeFocused();
}
