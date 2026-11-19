import { test, expect } from '@playwright/test';
import { seedLearning } from './lib/app';
import { learnStateWith } from './lib/kana';

test.describe('the statistics page', () => {
  test('the activity map fits a phone without a horizontal scroll', async ({ page }) => {
    await page.setViewportSize({ width: 375, height: 800 });
    const day = Math.floor(Date.now() / 864e5);
    const buckets: Record<string, Record<string, number>> = {};
    for (let back = 0; back < 120; back += 2) buckets[String(day - back)] = { '8': 5 + back };
    await seedLearning(page, '/stats#learning', {
      ...learnStateWith(['あ', 'い']),
      activeDays: [[day - 119, day]],
      recallBuckets: { hiragana: buckets, katakana: {} },
    });
    await expect(page.getByTestId('activity-map')).toBeVisible();
    // 13 columns below 640 px, the last cell is today.
    expect(await page.getByTestId('activity-cell').count()).toBeLessThanOrEqual(13 * 7);
    const overflow = await page.evaluate(
      () => document.documentElement.scrollWidth - document.documentElement.clientWidth,
    );
    expect(overflow).toBeLessThanOrEqual(0);
  });
});
