import { describe, it, expect } from 'vitest';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { ciScope } from '../../scripts/ci-scope.mjs';

const repoRoot = join(import.meta.dirname, '../../../..');
const everything = { docsOnly: false, webE2e: true, syncE2e: true };

describe('what a change needs from CI (ADR 097)', () => {
  it('Markdown files only: nothing is built, deployed or run in a browser', () => {
    expect(ciScope(['docs/spec/metrics.md', 'README.md', 'apps/web/src/x/README.md'])).toEqual({
      docsOnly: true,
      webE2e: false,
      syncE2e: false,
    });
  });

  it('the API alone reaches the sync tests only', () => {
    expect(ciScope(['apps/api/src/routes/sync.ts', 'docs/spec/backend.md'])).toEqual({
      docsOnly: false,
      webE2e: false,
      syncE2e: true,
    });
  });

  it('the measurement tool and the content tool reach no browser test', () => {
    expect(ciScope(['apps/bench/scripts/seed.ts', 'packages/content/src/words.ts'])).toEqual({
      docsOnly: false,
      webE2e: false,
      syncE2e: false,
    });
  });

  it('anything the web application is built from runs everything', () => {
    for (const file of [
      'apps/web/src/pages/learn/ui/session-screen.tsx',
      'apps/web/e2e/sync/two-tabs.spec.ts',
      'apps/web/public/_redirects',
      'packages/shared/src/sync-runtime.ts',
      'packages/engine/src/matcher/compile.ts',
      'pnpm-lock.yaml',
      'package.json',
      'wrangler.toml',
      '.github/workflows/deploy.yml',
      'docs/design/source/tokens.json',
    ]) {
      expect(ciScope([file]), file).toEqual(everything);
    }
  });

  it('a single file of the web application in a mixed change runs everything', () => {
    expect(ciScope(['docs/a.md', 'apps/api/src/app.ts', 'packages/shared/src/types.ts'])).toEqual(
      everything,
    );
  });

  it('an empty list of files runs everything', () => {
    expect(ciScope([])).toEqual(everything);
  });
});

describe('the workflow', () => {
  const workflow = readFileSync(join(repoRoot, '.github/workflows/deploy.yml'), 'utf-8');
  const readScripts = (path: string): Record<string, string> => {
    const parsed: unknown = JSON.parse(readFileSync(join(repoRoot, path), 'utf-8'));
    if (typeof parsed !== 'object' || parsed === null || !('scripts' in parsed)) return {};
    const { scripts } = parsed;
    if (typeof scripts !== 'object' || scripts === null) return {};
    return Object.fromEntries(
      Object.entries(scripts).filter(
        (entry): entry is [string, string] => typeof entry[1] === 'string',
      ),
    );
  };

  it('runs the steps of `verify` one by one, so the steps and the script say the same', () => {
    const root = readScripts('package.json');
    const web = readScripts('apps/web/package.json');
    expect(root['verify']).toBe('pnpm run verify:quick && pnpm run e2e');
    expect(root['e2e']).toBe('pnpm -r --if-present run e2e');
    expect(web['e2e']).toBe('playwright test && playwright test -c playwright.sync.config.ts');
    expect(workflow).toContain('run: pnpm run verify:quick');
    expect(workflow).toContain('run: pnpm --filter @nekotype/web exec playwright test');
    expect(workflow).toContain('run: pnpm run e2e:sync');
  });

  it('decides the scope from the files, and judges a push by every commit it brings', () => {
    expect(workflow).toContain('node apps/web/scripts/ci-scope.mjs "$BASE" HEAD');
    expect(workflow).toContain(
      "github.event_name == 'pull_request' && 'HEAD^1' || github.event.before",
    );
  });

  it('skips the checks of a tree only for an artifact of a run of this repository', () => {
    expect(workflow).toContain('verified-${TREE}');
    expect(workflow).toContain('.expired == false');
    expect(workflow).toContain('.workflow_run.head_repository_id == ${REPO_ID}');
    // Only a push to `main` looks for it; a pull request never skips its checks this way.
    expect(workflow).toContain(
      "if: github.event_name == 'push' && github.ref == 'refs/heads/main'",
    );
  });

  it('keeps every browser and latency step on `main` unless the tree is verified', () => {
    // On `main` the scope of the files does not apply: only a verified tree skips the tests.
    expect(workflow).toContain(
      "(github.event_name != 'pull_request' || needs.scope.outputs.web_e2e == 'true')",
    );
    expect(workflow).toContain(
      "(github.event_name != 'pull_request' || needs.scope.outputs.sync_e2e == 'true')",
    );
    expect(workflow).toContain(
      "(github.event_name != 'pull_request' || needs.scope.outputs.latency == 'true')",
    );
    expect(workflow).toContain(
      "latency: ${{ github.event_name != 'pull_request' && 'true' || steps.latency.outputs.needed || 'true' }}",
    );
  });

  it('deploys only after every check job, and a skipped one does not stop it (ADR 098)', () => {
    expect(workflow).toContain('needs: [scope, checks, e2e-web, e2e-sync, latency]');
    expect(workflow).toContain("!cancelled() && needs.scope.result == 'success'");
    expect(workflow).toContain("!contains(needs.*.result, 'failure')");
  });

  it('gives the traces of each browser job an artifact name of its own', () => {
    const names = [...workflow.matchAll(/name: (playwright-test-results\S*)/g)].map(
      (match) => match[1],
    );
    expect(names).toHaveLength(3);
    expect(new Set(names).size).toBe(names.length);
  });
});
