import { test, expect } from '@playwright/test';
import type { Page } from '@playwright/test';
import { seedLog } from './lib/app';
import { learnedLog, romajiOf } from './lib/kana';

// Keystroke latency (docs/spec/quality.md, "Budgets" and "Latency measurement"), measured by the
// probe of the test build under 4x CPU throttling on recall, the one task that types: two learning
// sessions of 30 tasks. Two checks: the p95 against the budget, and the worst keystroke against a
// ceiling (ADR 048). The p95 alone cannot see a redraw that happens about one key in sixty.
const THROTTLE = 4;
const WORK_BUDGET_MS = 8;
// Two frames at 60 Hz.
const FRAME_BUDGET_MS = 2 * (1000 / 60);
// The ceilings of the worst keystroke, not to be loosened.
const WORK_MAX_MS = 25;
const FRAME_MAX_MS = 50;

type Sample = { readonly work: number; readonly frame: number };

function percentile(values: readonly number[], p: number): number {
  const sorted = [...values].sort((a, b) => a - b);
  return sorted[Math.max(0, Math.ceil(p * sorted.length) - 1)] ?? Number.NaN;
}

async function readSamples(page: Page): Promise<Sample[]> {
  return page.evaluate(() => {
    const probe: unknown = Reflect.get(window, '__nekotypeProbe');
    const samples: unknown =
      probe === null || typeof probe !== 'object' ? null : Reflect.get(probe, 'samples');
    if (!Array.isArray(samples)) throw new Error('the page has no latency probe');
    return samples.map((sample: { work: number; frame: number }) => ({
      work: sample.work,
      frame: sample.frame,
    }));
  });
}

// The keys go through the input source, and the task controller writes the buffer and the caret.
const SESSIONS = 2;
const SESSION_TASKS = 30;

// Plays one task of whatever kind is on screen, correctly, with the keys of a typist.
async function answerTask(page: Page): Promise<void> {
  const kind = await page.getByTestId('kana-task').getAttribute('data-kind');
  if (kind === 'recognition') {
    const wanted = (await page.getByTestId('task-prompt').textContent()) ?? '';
    const labels = await page.locator('.nk-opt .nk-opt__label').allTextContents();
    const index = labels.findIndex((label) => romajiOf.get(label) === wanted);
    expect(index).toBeGreaterThanOrEqual(0);
    await page.keyboard.press(`Digit${String(index + 1)}`);
    return;
  }
  const romaji =
    kind === 'introduction'
      ? ((await page.locator('.nk-task__ghost').getAttribute('aria-label')) ?? '')
      : romajiOf.get((await page.locator('[data-task-kana]').first().textContent()) ?? '');
  expect(romaji).toBeTruthy();
  for (const key of romaji ?? '') {
    await page.keyboard.press(key);
    await page.waitForTimeout(50);
  }
}

test(`keystroke latency of recall stays within the budgets at ${THROTTLE}x CPU throttling`, async ({
  page,
}) => {
  // Ten kana learned a month ago: both sessions open on reviews, then go on to new kana.
  await seedLog(
    page,
    '/',
    learnedLog(['あ', 'い', 'う', 'え', 'お', 'か', 'き', 'く', 'け', 'こ'], 30 * 864e5),
  );
  const client = await page.context().newCDPSession(page);
  await client.send('Emulation.setCPUThrottlingRate', { rate: THROTTLE });

  await expect(page.getByTestId('home-reason')).toBeVisible();
  await page.getByRole('button', { name: 'continue' }).click();
  // The input source, and the probe with it, loads with the session chunk (ADR 067).
  await expect(page.getByTestId('task-session')).toHaveText(
    `learning · 1 of ${String(SESSION_TASKS)}`,
  );
  await page.waitForFunction(() => Reflect.get(window, '__nekotypeProbe') !== undefined);
  await page.evaluate(() => {
    const probe: unknown = Reflect.get(window, '__nekotypeProbe');
    if (probe === null || typeof probe !== 'object') throw new Error('no probe');
    const reset: unknown = Reflect.get(probe, 'reset');
    if (typeof reset === 'function') Reflect.apply(reset, probe, []);
  });

  for (let session = 1; session <= SESSIONS; session++) {
    for (let n = 1; n <= SESSION_TASKS; n++) {
      await expect(page.getByTestId('task-session')).toHaveText(
        `learning · ${String(n)} of ${String(SESSION_TASKS)}`,
      );
      await answerTask(page);
    }
    await expect(page.getByRole('heading', { name: 'session summary' })).toBeVisible();
    // A click, not Enter: the test does not depend on the hidden field's Enter handling.
    if (session < SESSIONS) await page.getByRole('button', { name: /continue/ }).click();
  }
  await page.waitForTimeout(200);

  const samples = (await readSamples(page)).filter(
    (s) => Number.isFinite(s.work) && Number.isFinite(s.frame),
  );
  expect(samples.length, 'a sample for the keys of two sessions').toBeGreaterThan(40);
  const works = samples.map((s) => s.work);
  const frames = samples.map((s) => s.frame);
  const work = percentile(works, 0.95);
  const frame = percentile(frames, 0.95);
  const report =
    `recall: ${String(samples.length)} keys, work p95 ${work.toFixed(2)} ms (budget ${WORK_BUDGET_MS}, max ${Math.max(...works).toFixed(2)}, ceiling ${WORK_MAX_MS}), ` +
    `frame p95 ${frame.toFixed(2)} ms (budget ${FRAME_BUDGET_MS.toFixed(1)}, max ${Math.max(...frames).toFixed(2)}, ceiling ${FRAME_MAX_MS})`;
  test.info().annotations.push({ type: 'latency', description: report });
  console.log(`\nKeystroke latency of recall at ${THROTTLE}x CPU throttling\n${report}`);

  expect(work, 'keystroke work, p95').toBeLessThanOrEqual(WORK_BUDGET_MS);
  expect(frame, 'keystroke to next frame, p95').toBeLessThanOrEqual(FRAME_BUDGET_MS);
  expect(Math.max(...works), 'keystroke work, worst').toBeLessThanOrEqual(WORK_MAX_MS);
  expect(Math.max(...frames), 'keystroke to next frame, worst').toBeLessThanOrEqual(FRAME_MAX_MS);
});
