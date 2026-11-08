import { describe, it, expect } from 'vitest';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { ROUTE_PATHS } from './route-paths';

const redirects = readFileSync(
  fileURLToPath(new URL('../../public/_redirects', import.meta.url)),
  'utf-8',
);

describe('_redirects: every screen but / opens the single page application', () => {
  const rules = redirects
    .split('\n')
    .map((line) => line.trim())
    .filter((line) => line !== '' && !line.startsWith('#'))
    .map((line) => line.split(/\s+/));

  it('rewrites each known route, with and without a trailing slash, and nothing else', () => {
    const expected = ROUTE_PATHS.filter((path) => path !== '/').flatMap((path) => [
      path,
      `${path}/`,
    ]);
    expect(rules.map((rule) => rule[0])).toEqual(expected);
  });

  it('rewrites to / with status 200', () => {
    for (const rule of rules) {
      expect(rule.slice(1)).toEqual(['/', '200']);
    }
  });

  // Cloudflare Pages redirects /index.html to / (308). A rewrite to it is answered with that
  // redirect, so a reload of /type showed the trainer. The dev server cannot show this; the
  // Pages emulator (`wrangler pages dev apps/web/dist`) and the deployed preview can.
  it('never rewrites to /index.html', () => {
    expect(rules.some((rule) => rule[1] === '/index.html')).toBe(false);
  });

  it('has no catch-all rule, so unknown paths and missing assets still answer 404', () => {
    expect(rules.some((rule) => rule[0]?.includes('*'))).toBe(false);
  });
});
