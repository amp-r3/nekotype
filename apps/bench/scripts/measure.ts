// Deploys the bench to the Pages project `nekotype-bench`, tails it and measures one request of the
// real `/api/sync` in a cold and a warm isolate (p5-plan.md, PR 1, PR 5 and PR 13). Usage: `pnpm --filter @nekotype/bench run measure [--out file.json] [--only name,name]`.
import { execFileSync, spawn } from 'node:child_process';
import { writeFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { DEVICE_ID, LAST_SEQ } from '@nekotype/shared/testing';
import { batchBody } from './batches';
import type { Batch } from './batches';
import { SESSION_TOKEN, seed } from './seed';

const PROJECT = 'nekotype-bench';
const DEPLOYMENTS = 5; // cold: the first request after each of 5 fresh deployments
const WARM_REQUESTS = 50;
const TAIL_WARMUP_MS = 10_000;
const EVENT_WAIT_MS = 30_000;
/** One row of the table: a batch sent to `POST /api/sync`, or a `GET` of it. */
type Kind = { readonly name: string; readonly part: string | null; readonly batch: Batch | null };
// The real endpoint of `apps/api` (PR 5), on the year-long row of ADR 078.
const KINDS: readonly Kind[] = [
  { name: 'learning', part: null, batch: 'learning' },
  { name: 'capped', part: null, batch: 'capped' },
  { name: 'finished', part: null, batch: 'finished' },
  { name: 'get', part: null, batch: null },
  { name: 'get-recent', part: 'recent', batch: null },
  { name: 'get-buckets', part: 'buckets', batch: null },
  { name: 'get-rest', part: 'rest', batch: null },
];

const root = fileURLToPath(new URL('..', import.meta.url));

function wrangler(args: string[]): string {
  return execFileSync('pnpm', ['exec', 'wrangler', ...args], { cwd: root, encoding: 'utf8' });
}

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

function assertProjectExists(): void {
  const listing = wrangler(['pages', 'project', 'list']);
  if (!listing.includes(PROJECT)) {
    throw new Error(
      `The Pages project ${PROJECT} does not exist: creating it is the maintainer's step M1.`,
    );
  }
}

type Deployment = { id: string; url: string };

function deploy(): Deployment {
  const output = wrangler([
    'pages',
    'deploy',
    'public',
    '--project-name',
    PROJECT,
    '--branch',
    'main',
    '--commit-dirty=true',
  ]);
  if (output.includes('Delegating')) {
    throw new Error(
      'wrangler handed the deploy to Workers static assets: stop and report (p5-plan.md, section 2).',
    );
  }
  const url = /https:\/\/[a-z0-9-]+\.nekotype-bench\.pages\.dev/.exec(output)?.[0];
  if (url === undefined)
    throw new Error(`No ${PROJECT}.pages.dev address in the deploy output:\n${output}`);
  const listing: unknown = JSON.parse(
    wrangler([
      'pages',
      'deployment',
      'list',
      '--project-name',
      PROJECT,
      '--environment',
      'production',
      '--json',
    ]),
  );
  const found = Array.isArray(listing)
    ? listing.find(
        (item: unknown) =>
          typeof item === 'object' &&
          item !== null &&
          'Deployment' in item &&
          item.Deployment === url,
      )
    : undefined;
  if (
    typeof found !== 'object' ||
    found === null ||
    !('Id' in found) ||
    typeof found.Id !== 'string'
  ) {
    throw new Error(`The deployment ${url} is not in the deployment list.`);
  }
  return { id: found.Id, url };
}

type TailEvent = { cfRay: string; cpuTime: number; wallTime: number; outcome: string };

/** `wrangler pages deployment tail --format json` prints pretty objects one after another. */
function startTail(deployment: Deployment): {
  events: Map<string, TailEvent>;
  stop: () => void;
} {
  const events = new Map<string, TailEvent>();
  const child = spawn(
    'pnpm',
    [
      'exec',
      'wrangler',
      'pages',
      'deployment',
      'tail',
      deployment.id,
      '--project-name',
      PROJECT,
      '--environment',
      'production',
      '--format',
      'json',
    ],
    { cwd: root, stdio: ['ignore', 'pipe', 'inherit'] },
  );
  let buffer = '';
  let depth = 0;
  let inString = false;
  let escaped = false;
  let start = -1;
  child.stdout.setEncoding('utf8');
  child.stdout.on('data', (chunk: string) => {
    for (const char of chunk) {
      buffer += char;
      if (inString) {
        if (escaped) escaped = false;
        else if (char === '\\') escaped = true;
        else if (char === '"') inString = false;
        continue;
      }
      if (char === '"') inString = true;
      else if (char === '{') {
        if (depth === 0) start = buffer.length - 1;
        depth += 1;
      } else if (char === '}') {
        depth -= 1;
        if (depth === 0 && start >= 0) {
          record(buffer.slice(start));
          buffer = '';
          start = -1;
        }
      }
    }
  });
  function record(text: string): void {
    const item: unknown = JSON.parse(text);
    if (typeof item !== 'object' || item === null) return;
    const event: unknown = 'event' in item ? item.event : undefined;
    const request: unknown =
      typeof event === 'object' && event !== null && 'request' in event ? event.request : undefined;
    const headers: unknown =
      typeof request === 'object' && request !== null && 'headers' in request
        ? request.headers
        : undefined;
    const ray =
      typeof headers === 'object' && headers !== null && 'cf-ray' in headers
        ? headers['cf-ray']
        : undefined;
    if (
      typeof ray !== 'string' ||
      !('cpuTime' in item) ||
      !('wallTime' in item) ||
      !('outcome' in item)
    )
      return;
    events.set(ray, {
      cfRay: ray,
      cpuTime: Number(item.cpuTime),
      wallTime: Number(item.wallTime),
      outcome: String(item.outcome),
    });
  }
  return { events, stop: () => child.kill('SIGTERM') };
}

type Sample = {
  cpuTime: number | null;
  wallTime: number | null;
  outcome: string | null;
  status: number;
  rowsRead: number;
  rowsWritten: number;
  statements: number;
  responseBytes: number;
};

let nextSeq = LAST_SEQ + 1;

async function send(kind: Kind, url: string, events: Map<string, TailEvent>): Promise<Sample> {
  const query = new URLSearchParams({ deviceId: DEVICE_ID });
  if (kind.part !== null) query.set('part', kind.part);
  const address = `${url}/api/sync?${query}`;
  const signedIn = { cookie: `nt_session=${SESSION_TOKEN}`, origin: new URL(url).origin };
  const response =
    kind.batch === null
      ? await fetch(address, { headers: signedIn })
      : await fetch(address, {
          method: 'POST',
          headers: { ...signedIn, 'content-type': 'application/json' },
          body: JSON.stringify(batchBody(kind.batch, nextSeq)),
        });
  const body = await response.arrayBuffer();
  if (kind.batch !== null && response.status === 200) nextSeq += 1;
  // Every statement of the request, the session lookup included (`countingDb` of `apps/api`).
  const log: unknown = JSON.parse(response.headers.get('x-bench-meta') ?? '{}');
  const field = (name: string): number =>
    typeof log === 'object' && log !== null && name in log ? Number(Reflect.get(log, name)) : NaN;
  const rowsRead = field('rowsRead');
  const rowsWritten = field('rowsWritten');
  const statements = field('statements');
  // The response header has the data centre after a dash (`…b614-WAW`); the tail event has not.
  const ray = (response.headers.get('cf-ray') ?? '').split('-')[0] ?? '';
  const deadline = Date.now() + EVENT_WAIT_MS;
  while (!events.has(ray) && Date.now() < deadline) await sleep(250);
  const event = events.get(ray);
  return {
    cpuTime: event?.cpuTime ?? null,
    wallTime: event?.wallTime ?? null,
    outcome: event?.outcome ?? null,
    status: response.status,
    rowsRead,
    rowsWritten,
    statements,
    responseBytes: body.byteLength,
  };
}

function percentile(values: readonly number[], p: number): number {
  const sorted = [...values].sort((a, b) => a - b);
  return sorted[Math.min(sorted.length - 1, Math.ceil((p / 100) * sorted.length) - 1)] ?? NaN;
}

type KindResult = { kind: string; cold: Sample[]; warm: Sample[] };

async function measureKind(kind: Kind): Promise<KindResult> {
  const { name } = kind;
  console.log(`\n== ${name}: seeding`);
  seed();
  nextSeq = LAST_SEQ + 1;
  const cold: Sample[] = [];
  const warm: Sample[] = [];
  for (let i = 1; i <= DEPLOYMENTS; i += 1) {
    const deployment = deploy();
    console.log(`${name}: deployment ${i}/${DEPLOYMENTS} ${deployment.url}`);
    const tail = startTail(deployment);
    await sleep(TAIL_WARMUP_MS);
    cold.push(await send(kind, deployment.url, tail.events));
    if (i === DEPLOYMENTS) {
      for (let n = 0; n < WARM_REQUESTS; n += 1)
        warm.push(await send(kind, deployment.url, tail.events));
    }
    tail.stop();
  }
  return { kind: name, cold, warm };
}

function cpu(samples: readonly Sample[]): number[] {
  return samples.flatMap((sample) => (sample.cpuTime === null ? [] : [sample.cpuTime]));
}

function report(results: readonly KindResult[]): string {
  const lines = [
    '| request | cold cpuTime (ms, 5 deployments) | warm median | warm p95 | warm max | statements | rows_read | rows_written | response | not ok |',
    '| --- | --- | --- | --- | --- | --- | --- | --- | --- | --- |',
  ];
  for (const { kind, cold, warm } of results) {
    const w = cpu(warm);
    const all = [...cold, ...warm];
    // The first request after the seed; the maximum over all requests in brackets when it differs.
    const first = cold[0];
    const counted = (pick: (sample: Sample) => number): string => {
      const value = first === undefined ? NaN : pick(first);
      const max = Math.max(...all.map(pick));
      return max === value ? String(value) : `${value} (max ${max})`;
    };
    const notOk = all.filter(
      (sample) => sample.status !== 200 || (sample.outcome !== null && sample.outcome !== 'ok'),
    ).length;
    const noEvent = all.filter((sample) => sample.cpuTime === null).length;
    lines.push(
      `| ${kind} | ${cold.map((s) => s.cpuTime ?? '?').join(', ')} | ${percentile(w, 50)} | ${percentile(w, 95)} | ${Math.max(...w)} | ${counted((s) => s.statements)} | ${counted((s) => s.rowsRead)} | ${counted((s) => s.rowsWritten)} | ${first?.responseBytes ?? '?'} B | ${notOk} of ${all.length}, ${noEvent} without event |`,
    );
  }
  return lines.join('\n');
}

async function main(): Promise<void> {
  const outIndex = process.argv.indexOf('--out');
  const out = outIndex >= 0 ? process.argv[outIndex + 1] : undefined;
  const onlyIndex = process.argv.indexOf('--only');
  const only = onlyIndex >= 0 ? (process.argv[onlyIndex + 1] ?? '').split(',') : undefined;
  const kinds = only === undefined ? KINDS : KINDS.filter((kind) => only.includes(kind.name));
  if (kinds.length === 0)
    throw new Error(`--only names none of: ${KINDS.map((k) => k.name).join(', ')}`);
  assertProjectExists();
  const results: KindResult[] = [];
  for (const kind of kinds) {
    results.push(await measureKind(kind));
    // Written after every kind, so a run that stops half-way keeps what it measured.
    if (out !== undefined) writeFileSync(out, JSON.stringify(results, null, 2));
  }
  console.log(`\n${report(results)}`);
}

await main();
