import { test, expect } from '@playwright/test';
import { openTypingScreen, seedSettings } from './lib/app';
import type { Page } from '@playwright/test';
import { canonicalOfPrompt } from './lib/prompt';

const RESTART = { name: 'Restart test' };

async function box(page: Page, testId: string) {
  const found = await page.getByTestId(testId).boundingBox();
  if (found === null) throw new Error(`${testId} has no box`);
  return found;
}

test.describe('the text stream', () => {
  test('keeps the answer out of the DOM: tests work it out from the prompt text', async ({
    page,
  }) => {
    await openTypingScreen(page);
    await expect(page.getByTestId('prompt-arena')).toHaveAttribute('data-phase', 'idle');
    await expect(page.getByTestId('prompt-text')).not.toHaveText('');
    await expect(page.locator('[data-canonical]')).toHaveCount(0);
  });

  test('shows the prompt to type and the prompts after it, with the caret at the start', async ({
    page,
  }) => {
    await openTypingScreen(page);
    await expect(page.getByTestId('prompt-arena')).toHaveAttribute('data-phase', 'idle');

    // Many tokens are drawn, numbered from 0, and the first prompt is the one to type.
    const tokens = page.locator('[data-token]');
    expect(await tokens.count()).toBeGreaterThan(20);
    await expect(tokens.first()).toHaveAttribute('data-token', '0');
    const first = await page.getByTestId('prompt-text').innerText();
    expect(first.length).toBeGreaterThan(0);
    await expect(page.locator('.nk-caret')).toBeVisible();
  });

  test('the caret moves and the typed kana change colour, without the text moving', async ({
    page,
  }) => {
    await openTypingScreen(page);
    const caret = page.locator('.nk-caret');
    const before = await caret.evaluate((el) => el.style.transform);
    const arenaBefore = await box(page, 'prompt-arena');

    const word = await canonicalOfPrompt(page);
    await page.keyboard.type(word, { delay: 20 });

    // The first prompt is typed: its token is in the typed colour, the caret moved on.
    await expect(page.locator('[data-token="0"]')).toHaveClass(/is-correct/);
    await expect.poll(() => caret.evaluate((el) => el.style.transform)).not.toBe(before);
    // The first token is typed even when the stream scrolled on a line.
    const arenaAfter = await box(page, 'prompt-arena');
    expect(arenaAfter.x).toBe(arenaBefore.x);
    expect(arenaAfter.width).toBe(arenaBefore.width);
    expect(arenaAfter.height).toBe(arenaBefore.height);
  });

  test('a wrong key marks the token and flashes the caret', async ({ page }) => {
    await openTypingScreen(page);
    // Watch the flash: the writer animates the caret's flash layer through opacity.
    await page.locator('.nk-caret__reject').evaluate((el) => {
      const original = el.animate.bind(el);
      el.animate = (keyframes, options) => {
        Object.assign(window, { flashed: true });
        return original(keyframes, options);
      };
    });

    await page.keyboard.press('Digit1'); // ignored: not a letter
    await page.keyboard.press('KeyQ'); // starts no kana (unlike z: ジュ opens with zi)
    await expect(page.locator('[data-token="0"]')).toHaveClass(/is-miss/);
    await expect(page.getByTestId('prompt-arena')).toHaveAttribute('data-rejected', 'true');
    await expect.poll(() => page.evaluate(() => Reflect.get(window, 'flashed'))).toBe(true);
  });

  test('the translation of a word is shown under the stream', async ({ page }) => {
    await openTypingScreen(page);
    await page.getByRole('radio', { name: 'Words' }).click();
    await expect(page.getByTestId('prompt-text')).toHaveText(/^.{2,}$/);
    await expect(page.getByTestId('translation')).not.toHaveText('');
  });

  test(
    'the stream shows two lines on a phone and three on a wide screen',
    { tag: '@mobile' },
    async ({ page }, testInfo) => {
      await openTypingScreen(page);
      // Rows of tokens that are inside the clipped view.
      const rows = () =>
        page.evaluate(() => {
          const view = document.querySelector('.nk-test__text')?.getBoundingClientRect();
          if (view === undefined) return 0;
          const tops = new Set<number>();
          for (const token of document.querySelectorAll('[data-token]')) {
            const r = token.getBoundingClientRect();
            if (r.top >= view.top - 1 && r.bottom <= view.bottom + 1) tops.add(Math.round(r.top));
          }
          return tops.size;
        });
      await expect.poll(rows).toBe(testInfo.project.name === 'webkit-mobile' ? 2 : 3);
    },
  );
});

// Types the prompts as they come, until `done` is true after a prompt or `limit` keys were pressed.
// Returns the number of keys. How many tokens a key makes depends on the words, so the number of
// keys needed for a redraw is not fixed.
async function typeUntil(page: Page, limit: number, done: () => Promise<boolean>): Promise<number> {
  let pressed = 0;
  while (pressed < limit && !(await done())) {
    const keys = await canonicalOfPrompt(page);
    const promptText = page.getByTestId('prompt-text');
    const text = (await promptText.textContent()) ?? '';
    for (const key of keys) {
      await page.keyboard.press(key);
      pressed += 1;
    }
    // The page takes the keys a moment after they were sent: wait for the next prompt, or the same
    // prompt would be typed again out of step.
    try {
      await expect(promptText).not.toHaveText(text, { timeout: 500 });
    } catch {
      // Either the same word came twice, or a final ん is still waiting for a second `n`: a single
      // prompt's canonical spelling ends it with one, which in a stream is ambiguous.
      if (text.endsWith('ん') && (await page.locator('.nk-test__buffer').textContent()) === 'n') {
        await page.keyboard.press('n');
        pressed += 1;
      }
    }
  }
  return pressed;
}

type Redraw = { readonly shared: number; readonly moved: number; readonly caretGlide: number };

// Records every redraw of the stream (tokens added or removed): how far the tokens it keeps moved on
// the screen, and how far the caret is from where it was placed, which is not zero while it glides.
async function watchRedraws(page: Page): Promise<void> {
  await page.evaluate(() => {
    const view = document.querySelector('.nk-test__text');
    const inner = document.querySelector('.nk-test__inner');
    const caret = document.querySelector('.nk-caret');
    if (view === null || inner === null || caret === null) throw new Error('no stream');
    const positions = () => {
      const origin = view.getBoundingClientRect();
      const result = new Map<string, [number, number]>();
      for (const token of inner.querySelectorAll<HTMLElement>('[data-token]')) {
        const r = token.getBoundingClientRect();
        result.set(token.dataset['token'] ?? '', [r.left - origin.left, r.top - origin.top]);
      }
      return result;
    };
    const redraws: unknown[] = [];
    Reflect.set(window, '__redraws', redraws);
    let before = positions();
    addEventListener('keyup', () => (before = positions()), true);
    new MutationObserver(() => {
      const after = positions();
      // A key may scroll the block by a line before the redraw, which moves every token alike: what
      // must not change is where the kept tokens are relative to each other.
      let shared = 0;
      let moved = 0;
      let anchor: [number, number, number, number] | undefined;
      for (const [token, [x, y]] of after) {
        const old = before.get(token);
        if (old === undefined) continue;
        shared += 1;
        anchor ??= [old[0], old[1], x, y];
        if (
          Math.abs(old[0] - anchor[0] - (x - anchor[2])) > 0.5 ||
          Math.abs(old[1] - anchor[1] - (y - anchor[3])) > 0.5
        ) {
          moved += 1;
        }
      }
      // The matrix of the caret as it is now against the one it was given.
      const at = (value: string) => value.match(/-?[\d.]+(?=px|[,)])/g)?.map(Number) ?? [];
      const shown = at(getComputedStyle(caret).transform);
      const placed = at((caret as HTMLElement).style.transform);
      // `matrix(a, b, c, d, x, y)` or `matrix3d(…)` with x and y at 12 and 13.
      const [x, y] = shown.length === 16 ? [shown[12] ?? 0, shown[13] ?? 0] : shown.slice(4, 6);
      const caretGlide =
        Math.abs((x ?? 0) - (placed[0] ?? 0)) + Math.abs((y ?? 0) - (placed[1] ?? 0));
      redraws.push({ shared, moved, caretGlide });
      before = after;
    }).observe(inner, { childList: true });
  });
}

async function readRedraws(page: Page): Promise<Redraw[]> {
  const raw: unknown = await page.evaluate(() => Reflect.get(window, '__redraws'));
  if (!Array.isArray(raw)) throw new Error('no redraws recorded');
  return raw.map((r: Redraw) => ({ shared: r.shared, moved: r.moved, caretGlide: r.caretGlide }));
}

test.describe('redrawing the stream', () => {
  for (const content of ['Words', 'Phrases']) {
    test(`${content}: the text does not move under the fingers and the caret does not glide`, async ({
      page,
    }) => {
      await openTypingScreen(page);
      await page.getByRole('radio', { name: content }).click();
      await expect(page.getByTestId('prompt-arena')).toHaveAttribute('data-phase', 'idle');
      await expect(page.getByTestId('prompt-text')).not.toHaveText('');
      // Words and phrases come in chunks of their own, and keys are ignored until one is in.
      await expect(page.getByTestId('translation')).not.toHaveText('');
      await watchRedraws(page);

      // Enough redraws to include trimmed ones: the first refills, the next ones trim.
      const keys = await typeUntil(page, 900, async () => (await readRedraws(page)).length >= 3);
      await page.waitForTimeout(150);

      const redraws = await readRedraws(page);
      // Steps, not every prompt: at least three redraws, and far fewer than one in ten keys.
      expect(redraws.length, `redraws in ${keys} keys`).toBeGreaterThanOrEqual(3);
      expect(redraws.length).toBeLessThan(keys / 10);
      expect(
        redraws.filter((r) => r.shared > 0 && r.moved > 0),
        'tokens kept by a redraw changed place',
      ).toEqual([]);
      expect(
        redraws.filter((r) => r.caretGlide > 0.5),
        'the caret glided across the screen after a redraw',
      ).toEqual([]);
    });
  }
});

test.describe('the interface while a test runs', () => {
  test('starting a test hides the navigation, the modes and the footer without moving the text', async ({
    page,
  }) => {
    await openTypingScreen(page);
    const before = await box(page, 'prompt-arena');
    await expect(page.getByRole('navigation')).toBeVisible();

    await page.keyboard.press('KeyA');
    await expect(page.getByTestId('prompt-arena')).toHaveAttribute('data-phase', 'running');
    await expect(page.getByRole('navigation')).toBeHidden();
    await expect(page.getByRole('radiogroup').first()).toBeHidden();
    await expect(page.getByRole('contentinfo')).toBeHidden();

    // Nothing moved: the interface only faded.
    const after = await box(page, 'prompt-arena');
    expect(after).toEqual(before);
  });

  test('the first Tab reaches Restart, and Enter restarts', async ({ page }) => {
    await openTypingScreen(page);
    // A key pressed before the vocabulary has loaded is ignored, so wait for the prompt.
    await expect(page.getByTestId('prompt-text')).not.toHaveText('');
    await page.keyboard.press('KeyA');
    await expect(page.getByTestId('prompt-arena')).toHaveAttribute('data-phase', 'running');

    await page.keyboard.press('Tab');
    await expect(page.getByRole('button', RESTART)).toBeFocused();
    await page.keyboard.press('Enter');
    await expect(page.getByTestId('prompt-arena')).toHaveAttribute('data-phase', 'idle');
    await expect(page.getByRole('navigation')).toBeVisible();
  });

  test('a mouse movement brings the interface back, and the next key hides it again', async ({
    page,
  }, testInfo) => {
    test.skip(testInfo.project.name === 'webkit-mobile', 'a touch screen has no mouse');
    await openTypingScreen(page);
    await expect(page.getByTestId('translation')).not.toHaveText('');
    await page.keyboard.press('KeyA');
    await expect(page.getByRole('navigation')).toBeHidden();

    await page.mouse.move(300, 300);
    await page.mouse.move(420, 380);
    await expect(page.getByRole('navigation')).toBeVisible();

    await page.keyboard.press('KeyA');
    await expect(page.getByRole('navigation')).toBeHidden();
  });

  test(
    'Restart shows when it has the focus, and always on a touch screen',
    { tag: '@mobile' },
    async ({ page }, testInfo) => {
      await openTypingScreen(page);
      const restart = page.getByRole('button', RESTART);
      if (testInfo.project.name === 'webkit-mobile') {
        await expect(restart).toHaveCSS('opacity', '1');
        return;
      }
      await expect(restart).toHaveCSS('opacity', '0');
      await page.keyboard.press('Tab');
      await expect(restart).toBeFocused();
      await expect(restart).toHaveCSS('opacity', '1');
    },
  );
});

test.describe('a phrase wider than the line (ADR 060)', () => {
  test.use({ viewport: { width: 360, height: 740 } });

  test('breaks between tokens and never runs past the edge of the stream @mobile', async ({
    page,
  }) => {
    await seedSettings(page, { typing: { content: 'phrases' } });
    await openTypingScreen(page);
    await expect(page.getByTestId('translation')).not.toHaveText('');

    // The phrases of the window are random, and the mark is set when the stream is measured, once
    // the fonts are in. A window of short phrases only has nothing to mark: load another one.
    const marked = async (): Promise<number> => {
      await page.evaluate(() => document.fonts.ready.then(() => undefined));
      return page.locator('.nk-word.is-long').count();
    };
    for (let attempt = 0; attempt < 12 && (await marked()) === 0; attempt++) {
      await page.reload();
      await openTypingScreen(page);
      await expect(page.getByTestId('translation')).not.toHaveText('');
    }

    const view = await box(page, 'prompt-arena');
    const right = view.x + view.width;
    const edges = await page
      .locator('[data-token]')
      .evaluateAll((tokens) => tokens.map((token) => token.getBoundingClientRect().right));
    expect(edges.length).toBeGreaterThan(20);
    expect(Math.max(...edges)).toBeLessThanOrEqual(right + 1);
    // At this width some phrase of the window is wider than a line, so it was marked.
    expect(await marked()).toBeGreaterThan(0);
  });

  test('a touch screen shows a button in place of the Esc hint @mobile', async ({ page }) => {
    await openTypingScreen(page);
    await expect(page.getByTestId('prompt-text')).not.toHaveText('');
    const coarse = await page.evaluate(() => window.matchMedia('(pointer: coarse)').matches);
    test.skip(!coarse, 'needs a touch device');
    const button = page.getByRole('button', { name: 'show the romaji' });
    await button.click();
    await expect(page.getByText(/^Revealed: /)).toBeVisible();
  });
});
