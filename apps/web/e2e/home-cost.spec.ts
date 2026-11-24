import { test, expect } from '@playwright/test';
import { syntheticLog } from '@nekotype/model/testing';
import { seedLog, seedTrack } from './lib/app';

// The cost of the learning home (docs/spec/quality.md, "Budgets"; P8 plan, D8; ADR 113): with 40,000
// answers in the log, the forecast and "since the last session" must be on screen within 300 ms of
// the moment the store is ready (the log read and folded; `model-cost.spec.ts` bounds that), under
// the 4x CPU throttling of the latency test. The probe build marks the moment
// (`nekotype:store-ready`); an init script records the first time the two blocks appear in the DOM.
// Pass: the median of three loads, for each block. The track is katakana: with hiragana selected
// every hiragana of this log is introduced and there is nothing to forecast.
const THROTTLE = 4;
const ANSWERS = 40_000;
const LOADS = 3;
const LINE_MS = 300;

type Appeared = { forecast: number | null; stronger: number | null; ready: number | null };

function median(values: readonly number[]): number {
  const sorted = [...values].sort((a, b) => a - b);
  return sorted[Math.floor(sorted.length / 2)] ?? Number.NaN;
}

test(`the forecast and what got stronger appear within ${String(LINE_MS)} ms of the store being ready at ${String(THROTTLE)}x CPU throttling`, async ({
  page,
}) => {
  test.setTimeout(240_000);
  await page.addInitScript(() => {
    const seen: { forecast: number | null; stronger: number | null } = {
      forecast: null,
      stronger: null,
    };
    Object.assign(window, { __homeCost: seen });
    const look = (): void => {
      const now = performance.now();
      if (seen.forecast === null && document.querySelector('[data-testid="home-forecast"]')) {
        seen.forecast = now;
      }
      if (seen.stronger === null && document.querySelector('[data-testid="home-stronger"]')) {
        seen.stronger = now;
      }
    };
    new MutationObserver(look).observe(document, { childList: true, subtree: true });
  });

  const events = syntheticLog({ answers: ANSWERS, seed: 1 });
  await seedLog(page, '/', events);
  await seedTrack(page, 'katakana');
  const client = await page.context().newCDPSession(page);
  await client.send('Emulation.setCPUThrottlingRate', { rate: THROTTLE });

  const forecast: number[] = [];
  const stronger: number[] = [];
  for (let load = 0; load < LOADS; load += 1) {
    await page.reload();
    await expect(page.getByTestId('home-forecast')).toBeVisible({ timeout: 30_000 });
    await expect(page.getByTestId('home-stronger')).toBeVisible({ timeout: 30_000 });
    const result = await page.evaluate((): Appeared => {
      const seen: unknown = Reflect.get(window, '__homeCost');
      const read = (key: string): number | null => {
        const value: unknown =
          seen === null || typeof seen !== 'object' ? null : Reflect.get(seen, key);
        return typeof value === 'number' ? value : null;
      };
      const mark = performance.getEntriesByName('nekotype:store-ready')[0];
      return {
        forecast: read('forecast'),
        stronger: read('stronger'),
        ready: mark?.startTime ?? null,
      };
    });
    if (result.ready === null || result.forecast === null || result.stronger === null) {
      throw new Error(`the probe saw nothing: ${JSON.stringify(result)}`);
    }
    forecast.push(result.forecast - result.ready);
    stronger.push(result.stronger - result.ready);
  }

  const fixed = (values: readonly number[]): string => values.map((v) => v.toFixed(0)).join(', ');
  const report =
    `${String(events.length)} events: forecast ${median(forecast).toFixed(0)} ms (loads ${fixed(forecast)}), ` +
    `what got stronger ${median(stronger).toFixed(0)} ms (loads ${fixed(stronger)}); line ${String(LINE_MS)} ms`;
  test.info().annotations.push({ type: 'home cost', description: report });
  console.log(`\nHome cost at ${String(THROTTLE)}x CPU throttling\n${report}`);

  expect(median(forecast), 'forecast, median').toBeLessThanOrEqual(LINE_MS);
  expect(median(stronger), 'what got stronger, median').toBeLessThanOrEqual(LINE_MS);
});
