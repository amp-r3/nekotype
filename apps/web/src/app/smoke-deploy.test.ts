import { describe, it, expect, vi } from 'vitest';
import {
  assetPaths,
  checkDeployment,
  resolveTargetUrl,
  waitForDeployment,
} from '../../scripts/smoke-deploy.mjs';
import type { FetchFn } from '../../scripts/smoke-deploy.mjs';
import { ROUTE_PATHS } from './route-paths';

const HTML =
  '<!doctype html><html><body><div id="app"></div><script src="/assets/index-a1.js"></script><link href="/assets/index-b2.css"></body></html>';
const NOT_FOUND = '<!doctype html><title>404</title><h1>Page not found</h1>';

function page(status: number, body: string, headers: Record<string, string> = {}): Response {
  return new Response(body, { status, headers: { 'content-type': 'text/html', ...headers } });
}

// A healthy deployment: the routes rewritten to the application, real 404s elsewhere.
function healthy(overrides: Record<string, () => Response> = {}): FetchFn {
  const routes = new Set<string>(['/']);
  for (const path of ROUTE_PATHS) {
    routes.add(path);
    routes.add(`${path}/`);
  }
  return (url) => {
    const path = url.pathname;
    const override = overrides[path];
    if (override) return Promise.resolve(override());
    if (routes.has(path)) return Promise.resolve(page(200, HTML));
    if (path === '/assets/index-a1.js') {
      return Promise.resolve(page(200, 'console.log(1)', { 'content-type': 'text/javascript' }));
    }
    if (path === '/assets/index-b2.css') {
      return Promise.resolve(page(200, 'a{}', { 'content-type': 'text/css' }));
    }
    return Promise.resolve(page(404, NOT_FOUND, { 'cache-control': 'no-store' }));
  };
}

describe('smoke test of a deployment', () => {
  it('passes for a deployment that serves the application on every route', async () => {
    const { failures, lines } = await checkDeployment('https://x.pages.dev', {
      fetchFn: healthy(),
    });
    expect(failures).toEqual([]);
    expect(lines.length).toBeGreaterThan(ROUTE_PATHS.length);
  });

  it('catches a route that is redirected instead of served (the 308 of ADR 039)', async () => {
    const fetchFn = healthy({
      '/type': () => new Response(null, { status: 308, headers: { location: '/' } }),
    });
    const { failures } = await checkDeployment('https://x.pages.dev', { fetchFn });
    expect(failures).toEqual(['/type should answer 200 with the application, got 308 -> /']);
  });

  it('catches a route that answers 404 or a page that is not the application', async () => {
    const fetchFn = healthy({
      '/stats/': () => page(404, NOT_FOUND),
      '/about': () => page(200, '<html>maintenance</html>'),
    });
    const { failures } = await checkDeployment('https://x.pages.dev', { fetchFn });
    expect(failures.map((f) => f.split(' ')[0])).toEqual(['/stats/', '/about']);
  });

  it('catches the retired /learn route still answering the application', async () => {
    const fetchFn = healthy({ '/learn': () => page(200, HTML) });
    const { failures } = await checkDeployment('https://x.pages.dev', { fetchFn });
    expect(failures).toHaveLength(1);
    expect(failures[0]).toContain('/learn should answer 404');
  });

  it('catches a missing asset that answers with the application (200)', async () => {
    const fetchFn: FetchFn = (url, init) =>
      url.pathname.startsWith('/assets/smoke-missing-')
        ? Promise.resolve(page(200, HTML))
        : healthy()(url, init);
    const { failures } = await checkDeployment('https://x.pages.dev', { fetchFn });
    expect(failures).toHaveLength(1);
    expect(failures[0]).toContain('/assets/smoke-missing-');
  });

  it('catches a 404 that is marked immutable', async () => {
    const fetchFn: FetchFn = (url, init) =>
      url.pathname.startsWith('/assets/smoke-missing-')
        ? Promise.resolve(
            page(404, NOT_FOUND, { 'cache-control': 'public, max-age=31536000, immutable' }),
          )
        : healthy()(url, init);
    const { failures } = await checkDeployment('https://x.pages.dev', { fetchFn });
    expect(failures.some((f) => f.includes('immutable'))).toBe(true);
  });

  it('catches an unknown path that is answered with the application', async () => {
    const { failures } = await checkDeployment('https://x.pages.dev', {
      fetchFn: healthy({ '/smoke-no-such-page': () => page(200, HTML) }),
    });
    expect(failures).toHaveLength(1);
    expect(failures[0]).toContain('/smoke-no-such-page');
  });

  it('catches a bundle the entry page names but the deployment lacks', async () => {
    const { failures } = await checkDeployment('https://x.pages.dev', {
      fetchFn: healthy({ '/assets/index-a1.js': () => page(404, NOT_FOUND) }),
    });
    expect(failures).toHaveLength(1);
    expect(failures[0]).toContain('/assets/index-a1.js');
  });

  it('lists the assets of the entry page', () => {
    expect(assetPaths(HTML)).toEqual(['/assets/index-a1.js', '/assets/index-b2.css']);
    expect(assetPaths('<a href="/learn">x</a>')).toEqual([]);
  });
});

describe('waiting for a new deployment', () => {
  it('retries until the application answers', async () => {
    const answers = [
      () => Promise.reject(new Error('ENOTFOUND')),
      () => Promise.resolve(page(404, NOT_FOUND)),
      () => Promise.resolve(page(200, HTML)),
    ];
    const fetchFn = vi.fn<FetchFn>(() =>
      (answers.shift() ?? answers[0] ?? (() => Promise.reject(new Error('none'))))(),
    );
    const sleep = vi.fn(() => Promise.resolve());
    const ready = await waitForDeployment('https://x.pages.dev', { fetchFn, sleep, attempts: 5 });
    expect(ready).toBe(true);
    expect(fetchFn).toHaveBeenCalledTimes(3);
    expect(sleep).toHaveBeenCalledTimes(2);
  });

  it('gives up after the attempts', async () => {
    const fetchFn = vi.fn<FetchFn>(() => Promise.resolve(page(404, NOT_FOUND)));
    const ready = await waitForDeployment('https://x.pages.dev', {
      fetchFn,
      sleep: () => Promise.resolve(),
      attempts: 3,
    });
    expect(ready).toBe(false);
    expect(fetchFn).toHaveBeenCalledTimes(3);
  });
});

describe('the address of the deployment', () => {
  const output = [
    JSON.stringify({ type: 'wrangler-session', version: 1 }),
    JSON.stringify({
      type: 'pages-deploy-detailed',
      url: 'https://3f2a1b.nekotype.pages.dev',
      alias: 'https://pr-9.nekotype.pages.dev',
    }),
    '',
  ].join('\n');

  it('is read from the wrangler output file', () => {
    expect(
      resolveTargetUrl({ outputFile: 'out', fallback: 'https://fallback', readFile: () => output }),
    ).toBe('https://3f2a1b.nekotype.pages.dev');
  });

  it('falls back to the given address when the file is missing, empty or has no deployment', () => {
    const fallback = 'https://pr-9.nekotype.pages.dev';
    expect(
      resolveTargetUrl({
        outputFile: 'out',
        fallback,
        readFile: () => {
          throw new Error('ENOENT');
        },
      }),
    ).toBe(fallback);
    expect(resolveTargetUrl({ outputFile: 'out', fallback, readFile: () => '' })).toBe(fallback);
    expect(
      resolveTargetUrl({
        outputFile: 'out',
        fallback,
        readFile: () => '{"type":"other"}\nnot json',
      }),
    ).toBe(fallback);
    expect(resolveTargetUrl({ fallback })).toBe(fallback);
    expect(resolveTargetUrl({})).toBeUndefined();
  });
});
