import { test, expect } from '@playwright/test';
import { openTypingScreen } from './lib/app';
import type { Page } from '@playwright/test';

const WORDS_CHUNK = '**/assets/words-*.js';
const ARENA = 'prompt-arena';

async function arenaTop(page: Page): Promise<number> {
  const box = await page.getByTestId(ARENA).boundingBox();
  if (box === null) throw new Error('no arena');
  return box.y;
}

test.describe('trainer: lifecycle and vocabulary loading', () => {
  test('typing is ignored while the vocabulary loads, and nothing moves', async ({ page }) => {
    await page.route(WORDS_CHUNK, async (route) => {
      await new Promise((resolve) => setTimeout(resolve, 1500));
      await route.continue();
    });
    await openTypingScreen(page);
    const before = await arenaTop(page);

    await page.getByRole('radio', { name: 'Words' }).click();
    await expect(page.getByText('Loading vocabulary')).toBeVisible();
    await page.keyboard.type('nekoa', { delay: 20 });
    await expect(page.getByTestId(ARENA)).toHaveAttribute('data-phase', 'idle');
    expect(Math.abs((await arenaTop(page)) - before)).toBeLessThan(1);

    await expect(page.getByText('Loading vocabulary')).toBeHidden();
    await expect(page.getByTestId('prompt-text')).not.toHaveText('');
    expect(Math.abs((await arenaTop(page)) - before)).toBeLessThan(1);
    await page.keyboard.press('KeyA');
    await expect(page.getByTestId(ARENA)).toHaveAttribute('data-phase', 'running');
  });

  test('a chunk that arrives late does not reset a test of another content', async ({ page }) => {
    await page.route(WORDS_CHUNK, async (route) => {
      await new Promise((resolve) => setTimeout(resolve, 1500));
      await route.continue();
    });
    await openTypingScreen(page);
    await page.getByRole('radio', { name: 'Phrases' }).click();
    await expect(page.getByTestId('translation')).not.toHaveText('');
    await page.keyboard.press('KeyA');
    await expect(page.getByTestId(ARENA)).toHaveAttribute('data-phase', 'running');

    await page.waitForTimeout(2000);
    await expect(page.getByTestId(ARENA)).toHaveAttribute('data-phase', 'running');
  });

  test('a failed load keeps the setting, offers Retry and survives a reload', async ({ page }) => {
    // The idle prefetch asks for the chunk too, so the chunk fails until the test lets it through.
    let failing = true;
    await page.route(WORDS_CHUNK, async (route) => {
      if (failing) {
        await route.abort();
        return;
      }
      await route.continue();
    });
    await openTypingScreen(page);

    await expect(page.getByText('Failed to load the vocabulary')).toBeVisible();
    await expect(page.getByRole('radio', { name: 'Words' })).toHaveAttribute(
      'aria-checked',
      'true',
    );
    // There is nothing to type until Retry succeeds.
    await expect(page.getByTestId('prompt-text')).toHaveText('');

    await page.waitForTimeout(450);
    await page.reload();
    await expect(page.getByRole('radio', { name: 'Words' })).toHaveAttribute(
      'aria-checked',
      'true',
    );
    await expect(page.getByText('Failed to load the vocabulary')).toBeVisible();

    failing = false;
    await page.getByRole('button', { name: 'Try again' }).click();
    await expect(page.getByText('Failed to load the vocabulary')).toBeHidden();
    await expect(page.getByTestId('prompt-text')).not.toHaveText('');
  });

  test('leaving a running test leaves no timer alive', async ({ page }) => {
    await page.addInitScript(() => {
      const live = new Set<number>();
      const set = window.setInterval.bind(window);
      const clear = window.clearInterval.bind(window);
      window.setInterval = ((fn: TimerHandler, ms?: number, ...args: unknown[]) => {
        const id = set(fn, ms, ...args);
        live.add(id);
        return id;
      }) as typeof window.setInterval;
      window.clearInterval = ((id?: number) => {
        if (id !== undefined) live.delete(id);
        clear(id);
      }) as typeof window.clearInterval;
      Object.defineProperty(window, '__liveIntervals', { get: () => live.size });
    });
    const live = (): Promise<number> =>
      page.evaluate(() => Reflect.get(window, '__liveIntervals') as number);

    await openTypingScreen(page);
    await page.getByRole('radio', { name: 'Zen' }).click();
    const idle = await live();
    await page.keyboard.press('KeyA');
    await expect(page.getByTestId(ARENA)).toHaveAttribute('data-phase', 'running');
    expect(await live()).toBeGreaterThan(idle);

    await page.keyboard.press('Tab');
    await page.getByRole('link', { name: 'about' }).click();
    await expect(page.getByRole('heading', { level: 1, name: 'About' })).toBeVisible();
    expect(await live()).toBeLessThanOrEqual(idle);
  });
});
