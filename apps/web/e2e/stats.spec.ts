import { test, expect } from '@playwright/test';
import { seedLearning } from './lib/app';
import { learnStateWith } from './lib/kana';

function state(day: number, buckets: Record<string, Record<string, number>>) {
  return {
    ...learnStateWith(['あ', 'い']),
    activeDays: [[day - 119, day]] satisfies [number, number][],
    recallBuckets: { hiragana: buckets, katakana: {} },
  };
}

test.describe('the statistics page', () => {
  test('the activity map fits a phone without a horizontal scroll', async ({ page }) => {
    await page.setViewportSize({ width: 375, height: 800 });
    const day = Math.floor(Date.now() / 864e5);
    const buckets: Record<string, Record<string, number>> = {};
    for (let back = 0; back < 120; back += 2) buckets[String(day - back)] = { '8': 5 + back };
    await seedLearning(page, '/stats', state(day, buckets));
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
    const day = Math.floor(Date.now() / 864e5);
    await seedLearning(page, '/stats', state(day, { [String(day)]: { '8': 5 } }));
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
});
