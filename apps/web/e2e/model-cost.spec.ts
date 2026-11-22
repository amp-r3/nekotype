import { test, expect } from '@playwright/test';
import { syntheticLog } from '@nekotype/model/testing';

// The cost of the knowledge model in the browser (docs/spec/quality.md, "Budgets"; ADR 100, point
// 10): the fold of 40,000 answers on both tracks and the forecast of the next katakana row, under
// the 4x CPU throttling of the latency test. The probe is in the test build only (`model-probe.ts`).
// Pass: the median fold within 100 ms and the median forecast within 200 ms; every run is printed.
const THROTTLE = 4;
const ANSWERS = 40_000;
const RUNS = 5;
const FOLD_BUDGET_MS = 100;
const FORECAST_BUDGET_MS = 200;

function median(values: readonly number[]): number {
  const sorted = [...values].sort((a, b) => a - b);
  return sorted[Math.floor(sorted.length / 2)] ?? Number.NaN;
}

test(`the fold and the forecast of the model stay within budget at ${THROTTLE}x CPU throttling`, async ({
  page,
}) => {
  const events = syntheticLog({ answers: ANSWERS, seed: 1 });
  await page.goto('/');
  await page.waitForFunction(
    () => typeof Reflect.get(window, '__nekotypeModelCost') === 'function',
  );
  const client = await page.context().newCDPSession(page);
  await client.send('Emulation.setCPUThrottlingRate', { rate: THROTTLE });

  const cost = await page.evaluate(
    ([log, runs]) => {
      const probe: unknown = Reflect.get(window, '__nekotypeModelCost');
      if (typeof probe !== 'function') throw new Error('the page has no model probe');
      const result: unknown = Reflect.apply(probe, window, [log, runs]);
      if (result === null || typeof result !== 'object') throw new Error('no result');
      const fold: unknown = Reflect.get(result, 'fold');
      const forecast: unknown = Reflect.get(result, 'forecast');
      if (!Array.isArray(fold) || !Array.isArray(forecast)) throw new Error('bad result');
      return { fold: fold.map(Number), forecast: forecast.map(Number) };
    },
    [events, RUNS] as const,
  );

  const fold = median(cost.fold);
  const forecast = median(cost.forecast);
  const fixed = (values: readonly number[]): string => values.map((v) => v.toFixed(1)).join(', ');
  const report =
    `${String(events.length)} events, ${String(ANSWERS)} answers: ` +
    `fold ${fold.toFixed(1)} ms (budget ${FOLD_BUDGET_MS}; runs ${fixed(cost.fold)}), ` +
    `forecast ${forecast.toFixed(1)} ms (budget ${FORECAST_BUDGET_MS}; runs ${fixed(cost.forecast)})`;
  test.info().annotations.push({ type: 'model cost', description: report });
  console.log(`\nModel cost at ${THROTTLE}x CPU throttling\n${report}`);

  expect(cost.fold, 'timed folds').toHaveLength(RUNS);
  expect(fold, 'fold, median').toBeLessThanOrEqual(FOLD_BUDGET_MS);
  expect(forecast, 'forecast, median').toBeLessThanOrEqual(FORECAST_BUDGET_MS);
});
