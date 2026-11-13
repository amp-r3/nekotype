import { execFileSync } from 'node:child_process';
import { appendFileSync } from 'node:fs';
import { pathToFileURL } from 'node:url';

// Paths whose change can move keystroke latency, or what the latency test measures through: the
// input source and the session behind it, the trainer and the learning session, the prompts and
// their lazy chunks, the dictionary parts, lazy loading and prefetch, the engine, the test itself
// and the build. A pull request that touches one runs the latency gate in CI; the others do not
// (ADR 074, which narrows ADR 052). Prefixes of repository paths.
export const LATENCY_PATHS = [
  'apps/web/src/shared/lib/input/',
  'apps/web/src/features/training/',
  'apps/web/src/pages/trainer/',
  'apps/web/src/pages/learn/',
  'apps/web/src/entities/prompt/',
  'apps/web/src/shared/i18n/',
  'apps/web/src/shared/ui/',
  'apps/web/src/app/',
  'apps/web/e2e/latency.spec.ts',
  'apps/web/e2e/lib/',
  'apps/web/playwright.latency.config.ts',
  'apps/web/scripts/latency-gate.mjs',
  'apps/web/scripts/latency-gate.d.mts',
  'apps/web/vite.config.ts',
  'packages/engine/',
  'pnpm-lock.yaml',
  '.github/workflows/',
];

/** Which of the changed files (repository paths) make the latency gate necessary. */
export function latencyRelevant(files) {
  return files.filter((file) => LATENCY_PATHS.some((prefix) => file.startsWith(prefix)));
}

/** The files a pull request changes, from its merge commit: against the first parent (the base). */
function changedFiles(base, head) {
  const out = execFileSync('git', ['diff', '--name-only', base, head], { encoding: 'utf8' });
  return out.split('\n').filter((line) => line !== '');
}

// CLI: node scripts/latency-gate.mjs <base> <head>. Prints what it found and writes
// `needed=true|false` to $GITHUB_OUTPUT. When the changes cannot be listed the gate runs: skipping
// it is the unsafe answer.
if (process.argv[1] !== undefined && import.meta.url === pathToFileURL(process.argv[1]).href) {
  const [base = 'HEAD^1', head = 'HEAD'] = process.argv.slice(2);
  let needed = true;
  try {
    const matches = latencyRelevant(changedFiles(base, head));
    needed = matches.length > 0;
    console.log(
      needed
        ? `Latency gate needed, changed: ${matches.join(', ')}`
        : 'Latency gate not needed: no changed file can move keystroke latency.',
    );
  } catch (error) {
    console.log(`Cannot list the changed files (${String(error)}): the latency gate runs.`);
  }
  if (process.env['GITHUB_OUTPUT'] !== undefined) {
    appendFileSync(process.env['GITHUB_OUTPUT'], `needed=${String(needed)}\n`);
  }
}
