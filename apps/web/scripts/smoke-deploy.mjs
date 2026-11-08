import { readFileSync } from 'node:fs';
import { pathToFileURL } from 'node:url';
import { ROUTE_PATHS } from '../src/app/route-paths.ts';

// Smoke test of a deployed build, run by CI after `wrangler pages deploy`. Some behaviour exists
// only on Cloudflare Pages and cannot be seen on the dev server: a rewrite to /index.html is
// answered with a redirect (ADR 039), and a missing /assets file must be a real 404, not the
// application (ADR 037). It requests the deployment itself.

const APP_MARKER = 'id="app"';

const header = (response, name) => response.headers.get(name) ?? '';

async function get(fetchFn, baseUrl, path) {
  const response = await fetchFn(new URL(path, baseUrl), { redirect: 'manual' });
  return { response, body: await response.text() };
}

function describeResponse(response) {
  const location = header(response, 'location');
  return `${response.status}${location === '' ? '' : ` -> ${location}`}`;
}

// The static assets the entry page names, so a deployment that lost its bundle is caught.
export function assetPaths(html) {
  const found = new Set();
  for (const match of html.matchAll(/(?:src|href)="(\/assets\/[^"]+)"/g)) {
    if (match[1] !== undefined) found.add(match[1]);
  }
  return [...found];
}

/**
 * Requests the deployment and returns what is wrong with it; an empty list means it is fine.
 * `fetchFn` is injectable for tests.
 */
export async function checkDeployment(baseUrl, { fetchFn = fetch } = {}) {
  const failures = [];
  const lines = [];

  const expectApp = async (path, label) => {
    const { response, body } = await get(fetchFn, baseUrl, path);
    const ok =
      response.status === 200 &&
      header(response, 'content-type').includes('text/html') &&
      body.includes(APP_MARKER);
    lines.push(`${ok ? 'ok  ' : 'FAIL'} ${label} ${path} ${describeResponse(response)}`);
    if (!ok)
      failures.push(
        `${path} should answer 200 with the application, got ${describeResponse(response)}`,
      );
    return body;
  };

  const entry = await expectApp('/', 'entry  ');
  for (const path of ROUTE_PATHS) {
    if (path === '/') continue;
    await expectApp(path, 'route  ');
    await expectApp(`${path}/`, 'route  ');
  }

  const expectNotFound = async (path, label) => {
    const { response, body } = await get(fetchFn, baseUrl, path);
    const ok = response.status === 404 && !body.includes(APP_MARKER);
    lines.push(`${ok ? 'ok  ' : 'FAIL'} ${label} ${path} ${describeResponse(response)}`);
    if (!ok)
      failures.push(
        `${path} should answer 404 and not the application, got ${describeResponse(response)}`,
      );
    return response;
  };

  const missing = `/assets/smoke-missing-${Date.now()}.js`;
  const missingResponse = await expectNotFound(missing, 'missing ');
  if (header(missingResponse, 'cache-control').includes('immutable')) {
    failures.push(`${missing} is a 404 marked immutable: it would be cached for a year`);
  }
  await expectNotFound('/smoke-no-such-page', 'unknown ');
  // /learn was the learning screen's address before it moved to / (P3): it answers 404 now.
  await expectNotFound('/learn', 'retired ');

  for (const path of assetPaths(entry)) {
    const { response, body } = await get(fetchFn, baseUrl, path);
    const ok = response.status === 200 && !body.includes(APP_MARKER);
    lines.push(`${ok ? 'ok  ' : 'FAIL'} asset   ${path} ${describeResponse(response)}`);
    if (!ok)
      failures.push(
        `${path} is named by the entry page but is missing, got ${describeResponse(response)}`,
      );
  }

  return { lines, failures };
}

/** Waits until the new deployment answers, since its address can lag behind the deploy command. */
export async function waitForDeployment(
  baseUrl,
  {
    fetchFn = fetch,
    attempts = 20,
    delayMs = 3000,
    sleep = (ms) => new Promise((r) => setTimeout(r, ms)),
  } = {},
) {
  for (let attempt = 1; attempt <= attempts; attempt++) {
    try {
      const { response, body } = await get(fetchFn, baseUrl, '/');
      if (response.status === 200 && body.includes(APP_MARKER)) return true;
    } catch {
      // not reachable yet
    }
    if (attempt < attempts) await sleep(delayMs);
  }
  return false;
}

/**
 * The address of the deployment that was just made: wrangler writes it to the file named by
 * WRANGLER_OUTPUT_FILE_PATH, one JSON object per line. Falls back to the given address (the branch
 * alias) when the file has no such entry.
 */
export function resolveTargetUrl({
  outputFile,
  fallback,
  readFile = (p) => readFileSync(p, 'utf-8'),
}) {
  if (outputFile !== undefined) {
    try {
      for (const line of readFile(outputFile).split('\n')) {
        if (line.trim() === '') continue;
        const entry = JSON.parse(line);
        if (entry.type === 'pages-deploy-detailed' && typeof entry.url === 'string') {
          return entry.url;
        }
      }
    } catch {
      // no usable output: use the fallback
    }
  }
  return fallback;
}

async function main(argv) {
  const args = new Map();
  const positional = [];
  for (let i = 0; i < argv.length; i++) {
    const arg = argv[i];
    if (arg !== undefined && arg.startsWith('--')) {
      args.set(arg.slice(2), argv[++i]);
    } else if (arg !== undefined) {
      positional.push(arg);
    }
  }
  const target = resolveTargetUrl({
    outputFile: args.get('wrangler-output'),
    fallback: args.get('fallback') ?? positional[0],
  });
  if (target === undefined) {
    console.error('usage: smoke-deploy.mjs <url> | --wrangler-output <file> --fallback <url>');
    return 2;
  }

  console.log(`Smoke test of ${target}`);
  if (!(await waitForDeployment(target))) {
    console.error(`${target} did not answer with the application in time`);
    return 1;
  }
  const { lines, failures } = await checkDeployment(target);
  for (const line of lines) console.log(line);
  if (failures.length > 0) {
    console.error(`\n${failures.length} problem(s):`);
    for (const failure of failures) console.error(`- ${failure}`);
    return 1;
  }
  console.log('\nDeployment smoke test passed.');
  return 0;
}

if (import.meta.url === pathToFileURL(process.argv[1] ?? '').href) {
  process.exitCode = await main(process.argv.slice(2));
}
