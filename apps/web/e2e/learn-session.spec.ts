import { test, expect } from '@playwright/test';
import { seedLog } from './lib/app';
import { learnedLog } from './lib/kana';
import { answer } from './lib/learn';

test.describe('learning session on /', () => {
  test('a full session of 30 tasks ends on the summary, `home` shows what got stronger @mobile', async ({
    page,
    isMobile,
  }) => {
    await page.goto('/');
    await expect(page.getByTestId('home-reason')).toBeVisible();
    // The forecast is the summary's "before": it is kept only when it was ready at the click.
    await expect(page.getByTestId('home-forecast')).toBeVisible();
    await page.getByRole('button', { name: 'continue' }).click();

    // The navigation is not drawn during a session.
    await expect(page.getByRole('navigation')).toHaveCount(0);

    for (let n = 1; n <= 30; n++) {
      await expect(page.getByTestId('task-session')).toHaveText(`learning · ${String(n)} of 30`);
      // Keys pressed before the task is shown are ignored; the task is on screen now.
      await answer(page, isMobile);
    }

    await expect(page.getByRole('heading', { name: 'session summary' })).toBeVisible();
    await expect(page.getByRole('navigation')).toBeVisible();
    // The first session opened the vowels: the forecast change names them, and what it introduced
    // is a row of cells that open the details.
    await expect(page.getByTestId('summary-forecast')).toContainText('the vowels are fully open');
    await expect(page.getByRole('button', { name: /^continue/ })).toBeVisible();
    const introduced = page.getByTestId('summary-introduced').getByTestId('summary-cell');
    await expect(introduced.first()).toBeVisible();
    await introduced.first().click();
    await expect(page.getByRole('dialog')).toBeVisible();
    await page.keyboard.press('Escape');
    await expect(page.getByRole('dialog')).toHaveCount(0);
    await expect(introduced.first()).toBeFocused();

    // `home` returns to `/`: the kana the session raised are under "since the last session".
    await page.getByRole('button', { name: 'home' }).click();
    await expect(page.getByTestId('home-reason')).toBeVisible();
    const stronger = page.getByTestId('home-stronger').getByTestId('since-cell');
    await expect(stronger.first()).toBeVisible();
    await stronger.first().click();
    await expect(page.getByRole('dialog')).toBeVisible();
    await page.keyboard.press('Escape');
    await expect(page.getByRole('dialog')).toHaveCount(0);

    // Continue starts the next session, and leaving it shows the home again.
    await page.getByRole('button', { name: /^continue/ }).click();
    await expect(page.getByTestId('task-session')).toHaveText('learning · 1 of 30');
    await page.getByRole('button', { name: 'leave session' }).click();
    await expect(page.getByTestId('home-reason')).toBeVisible();
  });

  test('leaving a session returns home and keeps the introduced kana', async ({ page }) => {
    await page.goto('/');
    await page.getByRole('button', { name: 'continue' }).click();
    await expect(page.getByTestId('kana-task')).toHaveAttribute('data-kind', 'introduction');
    await answer(page, false);
    await expect(page.getByTestId('task-session')).toHaveText('learning · 2 of 30');
    await page.getByRole('button', { name: 'leave session' }).click();
    await expect(page.getByTestId('home-reason')).toBeVisible();
    await expect(page.getByRole('navigation')).toBeVisible();
  });
});

test.describe('the stylesheet of the session', () => {
  test('one that failed to load is asked for again, so the session is not shown without it', async ({
    page,
  }) => {
    let offline = true;
    await page.route(/assets\/session-.*\.css$/, (route) =>
      offline ? route.abort() : route.continue(),
    );
    // The first try is the idle prefetch.
    const failed = page.waitForEvent('requestfailed', (request) =>
      /assets\/session-.*\.css$/.test(request.url()),
    );
    await page.goto('/');
    await expect(page.getByTestId('home-reason')).toBeVisible();
    await failed;

    offline = false;
    await page.getByRole('button', { name: 'continue' }).click();
    await expect(page.getByTestId('kana-task')).toHaveCSS('display', 'flex');
  });
});

test.describe('review in a session on /', () => {
  test('takes the due kana first, names it as the reason and clears it after', async ({ page }) => {
    // The learner came back every 2 hours on the first day, then stayed away for a month: the
    // planner looks ahead by the usual gap between sittings, so one month-long gap alone would make
    // the kana due again right after its review.
    const base = learnedLog(['あ'], 30 * 864e5);
    const last = base.at(-1);
    if (last === undefined) throw new Error('no seed events');
    const habit = [1, 2, 3].map((hours) => ({ ...last, at: last.at + hours * 2 * 3_600_000 }));
    await seedLog(page, '/', [...base, ...habit]);
    await expect(page.getByTestId('home-reason')).toHaveText('1 kana is due for review');
    await expect(page.getByRole('button', { name: /^review/ })).toHaveCount(0);
    await page.getByRole('button', { name: 'continue' }).click();

    await expect(page.getByTestId('task-session')).toHaveText('learning · 1 of 30');
    await expect(page.getByTestId('kana-task')).toHaveAttribute('data-kind', 'recall');
    await answer(page, false);
    await expect(page.getByTestId('task-session')).toHaveText('learning · 2 of 30');

    await page.getByRole('button', { name: 'leave session' }).click();
    // The review moved the kana a long way ahead, so nothing is due now.
    await expect(page.getByTestId('home-reason')).not.toHaveText(/due for review/);
  });
});
