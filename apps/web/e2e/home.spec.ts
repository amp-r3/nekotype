import { test, expect } from '@playwright/test';
import type { EventDraft } from '@nekotype/shared/types';
import { seedLog } from './lib/app';
import { learnedLog } from './lib/kana';
import { answer } from './lib/learn';

// The learning home on `/` (docs/spec/learning.md, "`/` screen"): what Continue does and why, the
// path and what got stronger. The reason's wording per state is in the unit tests of the page.

/** A session that started a day ago and taught the five vowels, so the home has a "since". */
function vowelsSession(): EventDraft[] {
  const learned = learnedLog(['あ', 'い', 'う', 'え', 'お'], 20 * 3_600_000);
  const first = learned[0];
  if (first === undefined) throw new Error('no seed events');
  return [{ t: 'start', at: first.at - 1000, tz: 0 }, ...learned];
}

test.describe('the learning home', () => {
  test('a fresh start reads "next: the vowels", has no chart, and a session introduces them', async ({
    page,
  }) => {
    await page.goto('/');
    await expect(page.getByTestId('home-reason')).toHaveText('next: the vowels');
    await expect(page.getByTestId('kana-chart')).toHaveCount(0);
    await expect(page.getByTestId('home-stronger')).toHaveCount(0);
    // `continue` has the focus: Enter starts the session, which opens on the first vowel.
    await expect(page.getByRole('button', { name: /^continue/ })).toBeFocused();
    await page.keyboard.press('Enter');
    await expect(page.getByTestId('kana-task')).toHaveAttribute('data-kind', 'introduction');
    await expect(page.locator('[data-task-kana]').first()).toHaveText('あ');
  });

  test('shows the path and opens another block by keyboard', async ({ page }) => {
    await page.goto('/');
    await expect(page.getByTestId('home-forecast')).toBeVisible();
    const basic = page.getByTestId('home-block-basic');
    const voiced = page.getByTestId('home-block-dakuten');
    await expect(basic).toHaveAttribute('aria-expanded', 'true');
    await voiced.focus();
    await page.keyboard.press('Enter');
    await expect(voiced).toHaveAttribute('aria-expanded', 'true');
    await expect(basic).toHaveAttribute('aria-expanded', 'false');
    await expect(page.locator('#home-path-dakuten')).toBeVisible();
    await expect(page.locator('#home-path-basic')).toBeHidden();
  });

  test('what got stronger lists the kana as cells that open their details, and Esc gives the focus back', async ({
    page,
  }) => {
    await seedLog(page, '/', vowelsSession());
    await expect(page.getByTestId('home-stronger')).toBeVisible();
    const cells = page.getByTestId('since-cell');
    await expect(cells).toHaveCount(5);
    const first = cells.first();
    await expect(first).toHaveAttribute('aria-label', /^あ, a, learned: details$/);

    await first.focus();
    await page.keyboard.press('Enter');
    await expect(page.getByTestId('kana-details')).toBeVisible();
    await page.keyboard.press('Escape');
    await expect(page.locator('dialog[open]')).toHaveCount(0);
    await expect(first).toBeFocused();
  });

  test('Continue runs a session from the home and leaving returns to it', async ({ page }) => {
    await seedLog(page, '/', vowelsSession());
    await expect(page.getByTestId('home-reason')).toBeVisible();
    await page.getByRole('button', { name: /^continue/ }).click();
    await expect(page.getByTestId('kana-task')).toBeVisible();
    await answer(page, false);
    await page.getByRole('button', { name: 'leave session' }).click();
    await expect(page.getByTestId('home-reason')).toBeVisible();
    await expect(page.getByTestId('home-forecast')).toBeVisible();
  });
});
