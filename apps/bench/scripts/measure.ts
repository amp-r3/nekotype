// Deploys the bench to the Pages project `nekotype-bench`, tails it and measures one sync in a cold
// and a warm isolate (p5-plan.md, PR 1). Usage: `pnpm --filter @nekotype/bench run measure [--out file.json] [--only name,name]`.
import { execFileSync, spawn } from 'node:child_process';
import { writeFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { KANA_KEYS, LAST_SEQ, generateBatch } from '@nekotype/shared/testing';
import { seed } from './seed';

const PROJECT = 'nekotype-bench';
const DEPLOYMENTS = 5; // cold: the first request after each of 5 fresh deployments
const WARM_REQUESTS = 50;
const TAIL_WARMUP_MS = 10_000;
const EVENT_WAIT_MS = 30_000;
type Batch = 'learning' | 'capped' | 'results';
/** One row of the table: a batch sent to a variant of the endpoint, or a `GET` of a variant. */
type Kind = { readonly name: string; readonly variant: string; readonly batch: Batch | null };
// `base` is ADR 078 as built (the measurement of PR 1). The other variants are the candidates of
// the follow-up to ADR 081; functions/api/sync.ts describes them.
const KINDS: readonly Kind[] = [
  { name: 'learning', variant: 'base', batch: 'learning' },
  { name: 'capped', variant: 'base', batch: 'capped' },
  { name: 'results', variant: 'base', batch: 'results' },
  { name: 'get', variant: 'base', batch: null },
  { name: 'empty', variant: 'empty', batch: null },
  { name: 'floor', variant: 'floor', batch: null },
  { name: 'ack-learning', variant: 'ack', batch: 'learning' },
  { name: 'ack-capped', variant: 'ack', batch: 'capped' },
  { name: 'keyed-learning', variant: 'keyed', batch: 'learning' },
  { name: 'keyed-capped', variant: 'keyed', batch: 'capped' },
  { name: 'keyed-results', variant: 'keyed', batch: 'results' },
  { name: 'get-recent', variant: 'recent', batch: null },
  { name: 'get-buckets', variant: 'buckets', batch: null },
  { name: 'get-rest', variant: 'rest', batch: null },
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
  const address = `${url}/api/sync?variant=${kind.variant}&deviceId=device-a`;
  const response =
    kind.batch === null
      ? await fetch(address)
      : await fetch(address, {
          method: 'POST',
          headers: { 'content-type': 'application/json' },
          body: JSON.stringify({
            ...generateBatch({ seed: 3, keys: KANA_KEYS, kind: kind.batch }),
            seq: nextSeq,
          }),
        });
  const body = await response.arrayBuffer();
  if (kind.batch !== null && response.status === 200) nextSeq += 1;
  const metas: unknown = JSON.parse(response.headers.get('x-bench-meta') ?? '[]');
  let rowsRead = 0;
  let rowsWritten = 0;
  let statements = 0;
  if (Array.isArray(metas)) {
    for (const meta of metas) {
      if (typeof meta !== 'object' || meta === null) continue;
      statements += 1;
      if ('rows_read' in meta) rowsRead += Number(meta.rows_read);
      if ('rows_written' in meta) rowsWritten += Number(meta.rows_written);
    }
  }
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
    '| request | cold cpuTime (ms, 5 deployments) | warm median | warm p95 | warm max | statements | rows_read | rows_written | response |',
    '| --- | --- | --- | --- | --- | --- | --- | --- | --- |',
  ];
  for (const { kind, cold, warm } of results) {
    const w = cpu(warm);
    const first = warm[0] ?? cold[0];
    lines.push(
      `| ${kind} | ${cold.map((s) => s.cpuTime ?? '?').join(', ')} | ${percentile(w, 50)} | ${percentile(w, 95)} | ${Math.max(...w)} | ${first?.statements ?? '?'} | ${first?.rowsRead ?? '?'} | ${first?.rowsWritten ?? '?'} | ${first?.responseBytes ?? '?'} B |`,
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
