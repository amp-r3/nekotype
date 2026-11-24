import { test, expect } from '@playwright/test';
import type { EventDraft } from '@nekotype/shared/types';
import { seedLog } from './lib/app';
import { learnedLog } from './lib/kana';

const DAY_MS = 864e5;

/**
 * A log of hiragana recall answers: `counts[back]` answers of あ at noon `back` days ago (the
 * device's zone is the page's), after a session start that gives the zone.
 */
function recallLog(counts: Readonly<Record<number, number>>, started = 1): EventDraft[] {
  const offset = -new Date().getTimezoneOffset();
  const today = Math.floor((Date.now() + offset * 60_000) / DAY_MS);
  const noon = (back: number): number => (today - back) * DAY_MS + DAY_MS / 2 - offset * 60_000;
  const backs = Object.keys(counts)
    .map(Number)
    .sort((x, y) => y - x);
  const first = noon(backs[0] ?? 0);
  const events: EventDraft[] = [];
  for (let i = 0; i < started; i++)
    events.push({ t: 'start', at: Math.min(first, Date.now()) - 1000, tz: offset });
  for (const back of backs) {
    for (let i = 0; i < (counts[back] ?? 0); i++) {
      events.push({
        t: 'answer',
        at: Math.min(noon(back) + i, Date.now()),
        task: 'recall',
        k: 'hiragana:あ',
        ok: true,
        ms: 1000 + 10 * i,
        hint: false,
        wrong: null,
        alt: null,
      });
    }
  }
  return events;
}

test.describe('the progress page', () => {
  test('the activity map fits a phone without a horizontal scroll', async ({ page }) => {
    await page.setViewportSize({ width: 375, height: 800 });
    const counts: Record<number, number> = {};
    for (let back = 0; back < 120; back += 2) counts[back] = 1 + (back % 7);
    await seedLog(page, '/progress', recallLog(counts));
    await expect(page.getByTestId('activity-map')).toBeVisible();
    // As many weeks as fit at 16 px: 15 columns at 375 px, the last cell is today.
    expect(await page.getByTestId('activity-cell').count()).toBeLessThanOrEqual(15 * 7);
    const overflow = await page.evaluate(
      () => document.documentElement.scrollWidth - document.documentElement.clientWidth,
    );
    expect(overflow).toBeLessThanOrEqual(0);
  });

  test('the activity map fills the width of its columns on a desktop', async ({ page }) => {
    await page.setViewportSize({ width: 1280, height: 900 });
    await seedLog(page, '/progress', recallLog({ 0: 5 }));
    const map = page.getByTestId('activity-map');
    await expect(map).toBeVisible();
    // 26 weeks, 7 rows; cells of at most 28 px reach the right edge of the figure.
    const cells = page.getByTestId('activity-cell');
    expect(await cells.count()).toBeGreaterThan(25 * 7);
    const box = await map.boundingBox();
    const first = await cells.first().boundingBox();
    expect(first?.width).toBeLessThanOrEqual(28);
    expect(first?.width).toBeGreaterThan(16);
    const lastColumn = await cells.nth(25 * 7).boundingBox();
    expect(
      (box?.x ?? 0) + (box?.width ?? 0) - ((lastColumn?.x ?? 0) + (lastColumn?.width ?? 0)),
    ).toBeLessThan(8);
  });

  test('shows the streak, the activity, the totals and the answer time of the log', async ({
    page,
  }) => {
    await seedLog(page, '/progress', recallLog({ 0: 4, 1: 3, 2: 2, 5: 1 }, 2));
    await expect(page.getByTestId('stats-streak')).toHaveText('3');
    await expect(page.getByTestId('stats-active-30')).toContainText('4');
    await expect(page.getByTestId('stats-started')).toHaveText('2');
    await expect(page.getByTestId('stats-finished')).toHaveText('0');
    await expect(page.getByTestId('stats-median-chart')).toBeVisible();
    await expect(page.getByTestId('chart-range')).toHaveCount(4);
    // The days of the current streak carry the dot.
    await expect(page.locator('[data-testid="activity-cell"].is-run')).toHaveCount(3);
  });
});

test.describe('the kana table on /progress', () => {
  test('a fresh start draws every kana locked, and a locked kana opens nothing', async ({
    page,
  }) => {
    await page.goto('/progress');
    await expect(page.getByTestId('kana-chart')).toBeVisible();
    await expect(page.locator('[data-testid="kana-cell"]:not([data-state="locked"])')).toHaveCount(
      0,
    );
    await page.getByTestId('kana-cell').first().click({ force: true });
    await expect(page.locator('dialog[open]')).toHaveCount(0);
  });

  test('a cell opens the details by mouse and by keys, Esc and ✕ return the focus to it', async ({
    page,
  }) => {
    await seedLog(page, '/progress', learnedLog(['あ'], 5 * 60_000));
    const cell = page.getByTestId('kana-cell').first();
    await expect(cell).toHaveAttribute('data-state', 'learned');
    await expect(cell).toHaveAttribute('aria-haspopup', 'dialog');

    await cell.click();
    const dialog = page.getByRole('dialog');
    await expect(dialog).toBeVisible();
    await expect(dialog.getByRole('heading', { level: 2 })).toHaveText('あ a');
    await expect(page.getByTestId('kana-details')).toContainText('learned');
    await page.keyboard.press('Escape');
    await expect(dialog).toBeHidden();
    await expect(cell).toBeFocused();

    await page.keyboard.press('Enter');
    await expect(dialog).toBeVisible();
    await page.getByRole('button', { name: 'close' }).click();
    await expect(dialog).toBeHidden();
    await expect(cell).toBeFocused();

    await page.keyboard.press('Space');
    await expect(dialog).toBeVisible();
    await page.keyboard.press('Escape');
    await expect(cell).toBeFocused();
  });

  test('the tooltip does not stay after the details are closed with the mouse', async ({
    page,
  }) => {
    await seedLog(page, '/progress', learnedLog(['あ'], 5 * 60_000));
    const cell = page.getByTestId('kana-cell').first();
    await expect(cell).toHaveAttribute('data-state', 'learned');
    await cell.click();
    await page.getByRole('button', { name: 'close' }).click();
    await page.mouse.move(5, 5);
    await expect(page.getByTestId('kana-tooltip')).toHaveCount(0);
    await page.mouse.move(5, 500);
    await expect(page.getByTestId('kana-tooltip')).toHaveCount(0);
  });

  test('the switch shows the other track and leaves the learning track alone', async ({ page }) => {
    await seedLog(page, '/progress', learnedLog(['あ'], 5 * 60_000));
    await expect(page.getByTestId('kana-cell').first()).toHaveText('あ');
    await page.getByRole('radio', { name: 'katakana' }).click();
    await expect(page.getByTestId('kana-cell').first()).toHaveText('ア');
    await expect(page.getByText('no katakana answers yet')).toBeVisible();
    await page.getByRole('navigation').getByRole('link', { name: 'learn' }).click();
    await expect(page.getByTestId('kana-cell').first()).toHaveText('あ');
  });
});
