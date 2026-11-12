import { test, expect } from '@playwright/test';
import type { Page } from '@playwright/test';
import { canonicalOfPrompt } from './lib/prompt';
import { seedLearning, seedSettings } from './lib/app';
import { learnStateWith, romajiOf } from './lib/kana';

// Keystroke latency (docs/spec/quality.md, "Budgets" and "Latency measurement"), measured by the
// probe of the test build under 4x CPU throttling on each kind of content: 200 keystrokes in a
// timed test, three runs. Two checks per kind: the median of the three p95 values against the
// budget, and the median of the three worst keystrokes against a ceiling (ADR 048). The p95 alone
// cannot see the redraw of the text stream, which is about one key in sixty.
const THROTTLE = 4;
const RUNS = 3;
const KEYSTROKES = 200;
// One wrong key in this many, so rejected keys (the flash) are part of what is measured.
const WRONG_EVERY = 25;
const WORK_BUDGET_MS = 8;
// Two frames at 60 Hz.
const FRAME_BUDGET_MS = 2 * (1000 / 60);
// The ceilings of the worst keystroke (the median of the three maxima), not to be loosened.
const WORK_MAX_MS = 25;
const FRAME_MAX_MS = 50;
// Long enough that the test is still running after the slowest throttled run (about 15 s of keys).
const TEST_SECONDS = 120;
const CONTENTS = ['words', 'phrases'] as const;

type Sample = { readonly work: number; readonly frame: number };

function percentile(values: readonly number[], p: number): number {
  const sorted = [...values].sort((a, b) => a - b);
  return sorted[Math.max(0, Math.ceil(p * sorted.length) - 1)] ?? Number.NaN;
}

const median = (values: readonly number[]): number => percentile(values, 0.5);

// Types the prompts as they come, one wrong key now and then, until `count` keys were pressed.
async function typeKeystrokes(page: Page, count: number): Promise<void> {
  let pressed = 0;
  while (pressed < count) {
    const canonical = await canonicalOfPrompt(page);
    for (const key of canonical) {
      if (pressed >= count) return;
      if (pressed > 0 && pressed % WRONG_EVERY === 0) {
        await page.keyboard.press('q');
        pressed += 1;
        if (pressed >= count) return;
      }
      await page.keyboard.press(key);
      pressed += 1;
      // A typist at about 20 keys a second: the next key does not queue behind this one's frame.
      await page.waitForTimeout(50);
    }
  }
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

for (const content of CONTENTS) {
  test(`keystroke latency stays within the budgets at 4x CPU throttling: ${content}`, async ({
    page,
  }) => {
    await seedSettings(page, {
      typing: {
        script: 'hiragana',
        content,
        weakFocus: false,
        test: { kind: 'time', seconds: TEST_SECONDS },
      },
    });
    const client = await page.context().newCDPSession(page);
    await client.send('Emulation.setCPUThrottlingRate', { rate: THROTTLE });

    const workP95: number[] = [];
    const frameP95: number[] = [];
    const workMax: number[] = [];
    const frameMax: number[] = [];
    const report: string[] = [];

    for (let run = 1; run <= RUNS; run++) {
      await page.goto('/type');
      await expect(page.getByTestId('prompt-arena')).toHaveAttribute('data-phase', 'idle');
      await page.evaluate(() => {
        const probe: unknown = Reflect.get(window, '__nekotypeProbe');
        if (probe === null || typeof probe !== 'object') throw new Error('no probe');
        const reset: unknown = Reflect.get(probe, 'reset');
        if (typeof reset === 'function') Reflect.apply(reset, probe, []);
      });

      await typeKeystrokes(page, KEYSTROKES);
      // The last frame's task has to arrive before the samples are read.
      await page.waitForTimeout(200);
      // A test that ended early would make the numbers cover something else (a results screen).
      await expect(
        page.getByTestId('prompt-arena'),
        `run ${run}: the ${TEST_SECONDS} s test is still running after ${KEYSTROKES} keys`,
      ).toHaveAttribute('data-phase', 'running');

      const samples = await readSamples(page);
      const complete = samples.filter((s) => Number.isFinite(s.work) && Number.isFinite(s.frame));
      expect(complete.length, `run ${run}: a sample for every keystroke`).toBe(KEYSTROKES);

      const works = complete.map((s) => s.work);
      const frames = complete.map((s) => s.frame);
      const work = percentile(works, 0.95);
      const frame = percentile(frames, 0.95);
      workP95.push(work);
      frameP95.push(frame);
      workMax.push(Math.max(...works));
      frameMax.push(Math.max(...frames));
      report.push(
        `${content} run ${run}: work p95 ${work.toFixed(2)} ms (median ${median(works).toFixed(2)}, max ${Math.max(...works).toFixed(2)}), ` +
          `frame p95 ${frame.toFixed(2)} ms (median ${median(frames).toFixed(2)}, max ${Math.max(...frames).toFixed(2)})`,
      );
    }

    const work = median(workP95);
    const frame = median(frameP95);
    const worstWork = median(workMax);
    const worstFrame = median(frameMax);
    report.push(
      `${content}, median of the p95 values: work ${work.toFixed(2)} ms (budget ${WORK_BUDGET_MS}), ` +
        `frame ${frame.toFixed(2)} ms (budget ${FRAME_BUDGET_MS.toFixed(1)})`,
      `${content}, median of the worst keystrokes: work ${worstWork.toFixed(2)} ms (ceiling ${WORK_MAX_MS}), ` +
        `frame ${worstFrame.toFixed(2)} ms (ceiling ${FRAME_MAX_MS})`,
    );
    // The numbers belong in the log of every run, not only in a failure.
    test.info().annotations.push({ type: 'latency', description: report.join('\n') });
    console.log(`\nKeystroke latency at ${THROTTLE}x CPU throttling\n${report.join('\n')}`);

    expect(work, 'keystroke work, median of the three p95 values').toBeLessThanOrEqual(
      WORK_BUDGET_MS,
    );
    expect(frame, 'keystroke to next frame, median of the three p95 values').toBeLessThanOrEqual(
      FRAME_BUDGET_MS,
    );
    expect(worstWork, 'keystroke work, median of the three worst keystrokes').toBeLessThanOrEqual(
      WORK_MAX_MS,
    );
    expect(
      worstFrame,
      'keystroke to next frame, median of the three worst keystrokes',
    ).toBeLessThanOrEqual(FRAME_MAX_MS);
  });
}

// The recall task of a learning session: the keys go through the same input source, and the task
// controller writes the buffer and the caret.
const SESSIONS = 2;
const SESSION_TASKS = 25;

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
  await seedLearning(
    page,
    '/',
    learnStateWith(['あ', 'い', 'う', 'え', 'お', 'か', 'き', 'く', 'け', 'こ']),
  );
  const client = await page.context().newCDPSession(page);
  await client.send('Emulation.setCPUThrottlingRate', { rate: THROTTLE });

  await expect(page.getByTestId('learn-mastered-count')).toBeVisible();
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
