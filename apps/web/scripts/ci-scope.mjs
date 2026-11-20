import { execFileSync } from 'node:child_process';
import { appendFileSync } from 'node:fs';
import { pathToFileURL } from 'node:url';

// What a change needs from CI beyond the checks that always run (ADR 097). The browser tests are
// the long part of a run; a change that cannot reach them does not run them. The rule is a
// whitelist of the changes that are known not to reach them: any other path, an empty list or a
// failure to list the files means everything runs. The keystroke latency gate has its own list
// (`latency-gate.mjs`, ADR 074) and is not decided here.

// Not code: no test reads a Markdown file, and `docs:check` and Prettier see all of them.
const DOCUMENT = /\.md$/;
// Reach the sync server of the sync e2e (`apps/web/e2e/sync-server`), not the web browser tests.
const SYNC_ONLY = ['apps/api/'];
// Reach neither: the web application depends on `engine` and `shared` only, the sync server on the
// API, and these are a measurement tool and the build tool of the content.
const INERT = ['apps/bench/', 'packages/content/'];

const startsWithAny = (file, prefixes) => prefixes.some((prefix) => file.startsWith(prefix));

/**
 * What the changed files (repository paths) need. `docsOnly`: only Markdown, so nothing is built or
 * deployed. `webE2e`: the Chromium and WebKit tests. `syncE2e`: the sync tests.
 */
export function ciScope(files) {
  if (files.length === 0) return { docsOnly: false, webE2e: true, syncE2e: true };
  const code = files.filter((file) => !DOCUMENT.test(file));
  if (code.length === 0) return { docsOnly: true, webE2e: false, syncE2e: false };
  const reachesWeb = code.some((file) => !startsWithAny(file, [...SYNC_ONLY, ...INERT]));
  const reachesSync = reachesWeb || code.some((file) => startsWithAny(file, SYNC_ONLY));
  return { docsOnly: false, webE2e: reachesWeb, syncE2e: reachesSync };
}

/** The files a change lists between two commits. */
function changedFiles(base, head) {
  const out = execFileSync('git', ['diff', '--name-only', base, head], { encoding: 'utf8' });
  return out.split('\n').filter((line) => line !== '');
}

// CLI: node scripts/ci-scope.mjs <base> <head>. Prints what it found and writes `docs_only`,
// `web_e2e` and `sync_e2e` to $GITHUB_OUTPUT. When the changes cannot be listed everything runs.
if (process.argv[1] !== undefined && import.meta.url === pathToFileURL(process.argv[1]).href) {
  const [base = 'HEAD^1', head = 'HEAD'] = process.argv.slice(2);
  let scope = { docsOnly: false, webE2e: true, syncE2e: true };
  try {
    scope = ciScope(changedFiles(base, head));
    console.log(`CI scope of ${base}..${head}: ${JSON.stringify(scope)}`);
  } catch (error) {
    console.log(`Cannot list the changed files (${String(error)}): everything runs.`);
  }
  if (process.env['GITHUB_OUTPUT'] !== undefined) {
    appendFileSync(
      process.env['GITHUB_OUTPUT'],
      `docs_only=${String(scope.docsOnly)}\nweb_e2e=${String(scope.webE2e)}\nsync_e2e=${String(scope.syncE2e)}\n`,
    );
  }
}
