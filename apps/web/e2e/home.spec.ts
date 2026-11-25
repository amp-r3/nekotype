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
    await expect(basic).toHaveAttribute('aria-checked', 'true');
    await voiced.focus();
    await page.keyboard.press('Enter');
    await expect(voiced).toHaveAttribute('aria-checked', 'true');
    await expect(basic).toHaveAttribute('aria-checked', 'false');
    await expect(page.locator('#home-path-dakuten')).toBeVisible();
    await expect(page.locator('#home-path-basic')).toHaveCount(0);
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

  test('on a desktop two bands: since the last session beside the action, the path under both, and the home stands high', async ({
    page,
  }) => {
    await page.setViewportSize({ width: 1440, height: 900 });
    await seedLog(page, '/', vowelsSession());
    await expect(page.getByTestId('home-stronger')).toBeVisible();
    const act = await page.locator('.nk-home__act').boundingBox();
    const since = await page.locator('.nk-home__since').boundingBox();
    const path = await page.locator('.nk-home__path').boundingBox();
    if (act === null || since === null || path === null) throw new Error('no boxes');
    expect(since.x).toBeGreaterThan(act.x + act.width / 2);
    expect(Math.abs(since.y - act.y)).toBeLessThan(40);
    expect(path.y).toBeGreaterThan(Math.max(act.y + act.height, since.y + since.height) - 1);
    // The page of the home fills the window between the navigation and the footer, and its top
    // stands under the first fifth of that height (the free space is shared 2 : 3 above and below).
    const free = await page.evaluate(() => {
      const main = document.querySelector('main');
      return main === null ? null : main.getBoundingClientRect();
    });
    const home = await page.locator('.nk-home-page').boundingBox();
    const top = await page.getByRole('radiogroup', { name: 'track' }).boundingBox();
    if (free === null || home === null || top === null) throw new Error('no layout');
    expect(Math.abs(home.height - free.height)).toBeLessThan(2);
    expect(top.y - free.top).toBeLessThan(0.2 * free.height);
    expect(
      await page.evaluate(() => document.documentElement.scrollHeight <= window.innerHeight),
    ).toBe(true);
  });

  test('Tab goes the way the eye does: continue, the kana of since, the blocks; the blocks are one stop', async ({
    page,
  }) => {
    await page.setViewportSize({ width: 1440, height: 900 });
    await seedLog(page, '/', vowelsSession());
    await expect(page.getByTestId('home-stronger')).toBeVisible();
    await expect(page.getByRole('button', { name: /^continue/ })).toBeFocused();
    await page.keyboard.press('Tab');
    await expect(page.getByTestId('since-cell').first()).toBeFocused();
    for (let i = 0; i < 5; i += 1) await page.keyboard.press('Tab');
    await expect(page.getByRole('radio', { name: /^basic: / })).toBeFocused();
    await page.keyboard.press('ArrowRight');
    await expect(page.getByRole('radio', { name: /^voiced: / })).toBeFocused();
    await expect(page.getByRole('radio', { name: /^voiced: / })).toHaveAttribute(
      'aria-checked',
      'true',
    );
  });

  test('on a phone the order is the action, the blocks, then since the last session, with no scroll sideways', async ({
    page,
  }) => {
    await page.setViewportSize({ width: 360, height: 780 });
    await seedLog(page, '/', vowelsSession());
    await expect(page.getByTestId('home-stronger')).toBeVisible();
    const path = await page.locator('.nk-home__path').boundingBox();
    const since = await page.locator('.nk-home__since').boundingBox();
    if (path === null || since === null) throw new Error('no boxes');
    expect(since.y).toBeGreaterThan(path.y);
    await expect(page.getByRole('button', { name: /^continue/ })).toBeFocused();
    await page.keyboard.press('Tab');
    await expect(page.getByRole('radio', { name: /^basic: / })).toBeFocused();
    expect(
      await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth),
    ).toBe(true);
  });
});
