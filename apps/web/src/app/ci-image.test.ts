import { describe, it, expect } from 'vitest';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';

// CI runs in the Playwright image (ADR 054). Its browsers are built for one version of Playwright,
// so the tag of the image must be the version that pnpm-lock.yaml installs.
const repoRoot = join(import.meta.dirname, '../../../..');

function lockedVersion(): string | undefined {
  const lock = readFileSync(join(repoRoot, 'pnpm-lock.yaml'), 'utf-8');
  return /^ {2}'@playwright\/test@(\d+\.\d+\.\d+)':/m.exec(lock)?.[1];
}

// Every browser job has its own `container` block (ADR 098), so every tag is checked.
function imageVersions(): (string | undefined)[] {
  const workflow = readFileSync(join(repoRoot, '.github/workflows/deploy.yml'), 'utf-8');
  return [...workflow.matchAll(/image: mcr\.microsoft\.com\/playwright:v(\d+\.\d+\.\d+)-/g)].map(
    (match) => match[1],
  );
}

describe('CI container image', () => {
  it('has the version of @playwright/test that pnpm-lock.yaml installs, in every job', () => {
    const locked = lockedVersion();
    expect(locked, '@playwright/test is not in pnpm-lock.yaml').toBeDefined();
    const versions = imageVersions();
    expect(versions.length, 'no Playwright image in .github/workflows/deploy.yml').toBeGreaterThan(
      0,
    );
    for (const version of versions) {
      expect(
        version,
        `Update every tag of the Playwright image in .github/workflows/deploy.yml to v${locked ?? '?'}`,
      ).toBe(locked);
    }
  });
});
